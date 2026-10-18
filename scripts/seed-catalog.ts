// Seeds the `formulations` catalog: the fictional Calmora demo products plus a hand-checked list of real
// oral OTC formulations pulled from openFDA (the demo packages: Tylenol, Motrin, Benadryl, Aleve, Midol,
// Pepto-Bismol, plus NyQuil and store-brand children's acetaminophen). Labels are mapped with the import's
// own mapper (`mapLabel`: the label's printed strength confirmed against its NDC Directory products). Labels
// that are the same formulation (same ingredients, strengths and form — e.g. relabelers) are grouped into one
// row with every package NDC. Idempotent: upserts on `slug`.
//
//   npm run seed                (reads .env.local; SUPABASE_SECRET_KEY bypasses RLS)
//   npm run seed -- --dry-run   (fetch and print the rows and what would change, write nothing)
//
// Then `npm run import:otc -- --with-medlineplus --enrich-reviewed --prune` gives these rows the card text the
// import gives every row (bullets cut at the label's DailyMed list items), and deletes imported rows whose
// package NDCs a seed row now carries — otherwise an NDC printed on a package would point to two rows.
import { createClient } from "@supabase/supabase-js";
import { FICTIONAL_FORMULATIONS } from "@/data/fictional-formulations";
import { formatStrength } from "@/lib/domain/fields";
import { indexNdcProducts, withNdcOpenfda } from "@/lib/fda/join";
import { mapLabel, rowIsTraceable } from "@/lib/fda/map";
import type { FdaLabel, NdcProduct } from "@/lib/fda/types";
import { ndc11FromHyphenated } from "@/lib/ndc";
import { formulationToRow, ndcProductsByProductNdc, searchLabels, type CatalogFormulation } from "@/lib/openfda";
import type { Database } from "@/lib/supabase/database.types";

export type SeedSpec = {
  slug: string;
  /** Display name for the grouped formulation: the brand as printed, then the form in parentheses. */
  brandName: string;
  /** openFDA label search that returns the labels to group. */
  search: string;
  limit?: number;
  dosageForm: string;
  /** Normalized ingredient → strength as `formatStrength` prints it. Must match exactly. */
  strengths: Record<string, string>;
  /** Take label text (directions, warnings, table) from the label carrying this NDC. */
  preferNdc?: string;
  excludeBrand?: RegExp;
  /**
   * NDC Directory product NDCs ("37000-438") of a label openFDA serves with an empty `openfda` block
   * (P&G's Pepto-Bismol, Children's Benadryl): its product type, route, brand, labeler and package NDCs come
   * from these. Only with a `search` for that one label's set id.
   */
  ndcProducts?: string[];
};

const NYQUIL = 'openfda.brand_name:"nyquil" AND active_ingredient:acetaminophen';
const CHILDRENS_TYLENOL = 'openfda.brand_name:"childrens tylenol" AND active_ingredient:"160 mg"';
const STORE_CHILDRENS = 'openfda.generic_name:"acetaminophen" AND openfda.brand_name:"childrens" AND active_ingredient:"160 mg"';
const ALEVE = 'openfda.brand_name:"aleve"';
const BENADRYL = 'openfda.brand_name:"benadryl"';
const MOTRIN_IB = 'openfda.brand_name:"motrin ib"';
/** Other Aleve products with their own names and labels (not the plain Aleve package). */
const ALEVE_OTHERS = /back|headache|arthritis|easy open|\bpm\b|aleve-d|sinus/i;
/** Other Benadryl products: other strengths, combinations, children's and topical. */
const BENADRYL_OTHERS = /plus|congestion|extra|children|dye|itch/i;

export const SEED_SPECS: SeedSpec[] = [
  // NyQuil (P&G)
  {
    slug: "nyquil-cold-flu-caplet",
    brandName: "NyQuil Cold & Flu VapoCOOL (caplets)",
    search: NYQUIL,
    dosageForm: "caplet",
    strengths: {
      acetaminophen: "325 mg per caplet",
      dextromethorphan: "10 mg per caplet",
      doxylamine: "6.25 mg per caplet",
    },
  },
  {
    slug: "nyquil-severe-cold-flu-caplet",
    brandName: "NyQuil Severe Cold & Flu VapoCOOL (caplets)",
    search: NYQUIL,
    dosageForm: "caplet",
    strengths: {
      acetaminophen: "325 mg per caplet",
      dextromethorphan: "10 mg per caplet",
      doxylamine: "6.25 mg per caplet",
      phenylephrine: "5 mg per caplet",
    },
    preferNdc: "37000-523-02",
  },
  {
    slug: "nyquil-hot-remedy-cold-flu-packet",
    brandName: "NyQuil Hot Remedy Cold & Flu (powder packets)",
    search: NYQUIL,
    dosageForm: "packet",
    strengths: {
      acetaminophen: "650 mg per packet",
      diphenhydramine: "25 mg per packet",
      phenylephrine: "10 mg per packet",
    },
  },
  // Tylenol (Kenvue)
  {
    slug: "childrens-tylenol-160mg-5ml",
    brandName: "Children's Tylenol Oral Suspension",
    search: CHILDRENS_TYLENOL,
    dosageForm: "liquid",
    strengths: { acetaminophen: "160 mg per 5 mL" },
    preferNdc: "50580-139-04",
  },
  {
    slug: "childrens-acetaminophen-160mg-5ml-store-brand",
    brandName: "Children's Pain & Fever Oral Suspension (store brands)",
    search: STORE_CHILDRENS,
    limit: 300,
    dosageForm: "liquid",
    strengths: { acetaminophen: "160 mg per 5 mL" },
    excludeBrand: /tylenol/i,
  },
  {
    slug: "childrens-tylenol-chewable-160mg",
    brandName: "Children's Tylenol Chewables",
    search: CHILDRENS_TYLENOL,
    dosageForm: "chewable tablet",
    strengths: { acetaminophen: "160 mg per chewable tablet" },
  },
  {
    slug: "tylenol-regular-strength-325mg-tablet",
    brandName: "Tylenol Regular Strength (tablets)",
    search: 'openfda.brand_name:"tylenol regular strength"',
    dosageForm: "tablet",
    strengths: { acetaminophen: "325 mg per tablet" },
  },
  {
    slug: "tylenol-extra-strength-500mg-caplet",
    brandName: "Tylenol Extra Strength (caplets)",
    search: 'openfda.brand_name:"tylenol extra strength"',
    dosageForm: "caplet",
    strengths: { acetaminophen: "500 mg per caplet" },
  },
  {
    slug: "tylenol-8hr-arthritis-pain-650mg-caplet",
    brandName: "Tylenol 8 HR Arthritis Pain (caplets)",
    search: 'openfda.brand_name:"tylenol 8 hr arthritis pain"',
    preferNdc: "50580-783-24",
    dosageForm: "extended-release tablet",
    strengths: { acetaminophen: "650 mg per extended-release tablet" },
  },
  {
    slug: "tylenol-pm-extra-strength-caplet",
    brandName: "Tylenol PM Extra Strength (caplets)",
    search: 'openfda.brand_name:"tylenol pm"',
    preferNdc: "50580-608-01",
    dosageForm: "caplet",
    strengths: { acetaminophen: "500 mg per caplet", diphenhydramine: "25 mg per caplet" },
  },
  // Midol (Bayer)
  {
    slug: "midol-complete-caplet",
    brandName: "Midol Complete (caplets)",
    search: 'openfda.brand_name:"midol complete"',
    preferNdc: "0280-8005-24",
    dosageForm: "caplet",
    strengths: { acetaminophen: "500 mg per caplet", caffeine: "60 mg per caplet", pyrilamine: "15 mg per caplet" },
  },
  // Aleve (Bayer)
  {
    slug: "aleve-220mg-caplet",
    brandName: "Aleve (caplets)",
    search: ALEVE,
    dosageForm: "caplet",
    strengths: { naproxen: "220 mg per caplet" },
    preferNdc: "0280-0114-01", // openFDA's copy of Bayer's other caplet label (0280-6000) has an empty Warnings section
    excludeBrand: ALEVE_OTHERS,
  },
  {
    slug: "aleve-liquid-gels-220mg-capsule",
    brandName: "Aleve Liquid Gels (capsules)",
    search: ALEVE,
    dosageForm: "capsule",
    strengths: { naproxen: "220 mg per capsule" },
    preferNdc: "0280-6080-20",
    excludeBrand: ALEVE_OTHERS,
  },
  // Benadryl (Kenvue)
  {
    slug: "benadryl-allergy-ultratabs-25mg-tablet",
    brandName: "Benadryl Allergy Ultratabs (tablets)",
    search: BENADRYL,
    dosageForm: "tablet",
    strengths: { diphenhydramine: "25 mg per tablet" },
    preferNdc: "50580-226-50",
    excludeBrand: BENADRYL_OTHERS,
  },
  {
    slug: "benadryl-allergy-liqui-gels-25mg-capsule",
    brandName: "Benadryl Allergy Liqui-Gels (capsules)",
    search: BENADRYL,
    dosageForm: "capsule",
    strengths: { diphenhydramine: "25 mg per capsule" },
    excludeBrand: BENADRYL_OTHERS,
  },
  {
    slug: "childrens-benadryl-allergy-12-5mg-5ml",
    brandName: "Children's Benadryl Allergy (liquid)",
    search: 'set_id:"fc9181b9-c92d-493e-8d7c-4a4239c6c092"',
    dosageForm: "liquid",
    strengths: { diphenhydramine: "12.5 mg per 5 mL" },
    ndcProducts: ["50580-534"],
  },
  // Motrin (Kenvue)
  {
    slug: "motrin-ib-200mg-caplet",
    brandName: "Motrin IB (caplets)",
    search: MOTRIN_IB,
    dosageForm: "caplet",
    strengths: { ibuprofen: "200 mg per caplet" },
    preferNdc: "50580-230-01",
    excludeBrand: /migraine/i,
  },
  {
    slug: "motrin-ib-liquid-gels-200mg-capsule",
    brandName: "Motrin IB Liquid Gels (capsules)",
    search: MOTRIN_IB,
    dosageForm: "capsule",
    strengths: { ibuprofen: "200 mg per capsule" },
    excludeBrand: /migraine/i,
  },
  {
    slug: "childrens-motrin-100mg-5ml",
    brandName: "Children's Motrin Oral Suspension (liquid)",
    search: 'set_id:"f2609308-17bf-4bcb-84b2-d17f3fd35958"',
    dosageForm: "liquid",
    strengths: { ibuprofen: "100 mg per 5 mL" },
  },
  // Pepto-Bismol (P&G): openFDA serves these labels with an empty openfda block.
  {
    slug: "pepto-bismol-525mg-30ml",
    brandName: "Pepto-Bismol (liquid)",
    search: 'set_id:"67006e82-870d-8d63-e053-2991aa0a02d1"',
    dosageForm: "liquid",
    strengths: { "bismuth subsalicylate": "525 mg per 30 mL" },
    ndcProducts: ["37000-438"],
  },
  {
    slug: "pepto-bismol-ultra-525mg-15ml",
    brandName: "Pepto-Bismol Ultra (liquid)",
    search: 'set_id:"673893bd-f8e9-23b0-e053-2a91aa0aa1d4"',
    dosageForm: "liquid",
    strengths: { "bismuth subsalicylate": "525 mg per 15 mL" },
    ndcProducts: ["37000-440"],
  },
  {
    slug: "pepto-bismol-262mg-caplet",
    brandName: "Pepto-Bismol (caplets)",
    search: 'set_id:"66d9d631-ba73-3ce4-e053-2a91aa0a1cc4"',
    dosageForm: "caplet",
    strengths: { "bismuth subsalicylate": "262 mg per caplet" },
    ndcProducts: ["58933-476"],
  },
  {
    slug: "pepto-bismol-chewables-262mg",
    brandName: "Pepto-Bismol Chewables (chewable tablets)",
    search: 'set_id:"06fce961-5e57-b640-e063-6394a90a9e8a"',
    dosageForm: "chewable tablet",
    strengths: { "bismuth subsalicylate": "262 mg per chewable tablet" },
    ndcProducts: ["58933-011"],
  },
];

/** "50580-472" for each package NDC on the label ("50580-472-01"), once each, in label order. */
export function productNdcsOf(label: FdaLabel): string[] {
  const products = (label.openfda?.package_ndc ?? []).flatMap((ndc) => ndc.match(/^(\d{4,5}-\d{3,4})-\d{1,2}$/)?.[1] ?? []);
  return [...new Set(products)];
}

/**
 * Labels → formulations with the import's mapper: rows it rejects, or whose strengths it can't trace to the
 * label's Active ingredient text, are left out. A label openFDA serves without an `openfda` block takes it
 * from `blocklessProducts` (the NDC Directory products of that one label). A label that is one row also keeps
 * every package NDC openFDA lists for it: older packages the NDC Directory no longer lists are still on shelves.
 */
export function seedFormulations(labels: FdaLabel[], products: NdcProduct[], blocklessProducts: NdcProduct[] = []): CatalogFormulation[] {
  const index = indexNdcProducts([...products, ...blocklessProducts]);
  return labels.flatMap((raw) => {
    const label = withNdcOpenfda(raw, blocklessProducts);
    const results = mapLabel(label, index);
    const rows = results.flatMap((r) => (r.ok && rowIsTraceable(r.formulation, label) ? [r.formulation] : []));
    if (results.length !== 1 || rows.length !== 1) return rows;
    const listed = (label.openfda?.package_ndc ?? []).map(ndc11FromHyphenated).filter((n): n is string => n !== null);
    return [{ ...rows[0], ndcPackages: [...new Set([...rows[0].ndcPackages, ...listed])] }];
  });
}

export function matchesSpec(f: CatalogFormulation, spec: SeedSpec): boolean {
  if (f.dosageForm !== spec.dosageForm) return false;
  if (spec.excludeBrand?.test(f.brandName)) return false;
  const wanted = Object.entries(spec.strengths);
  if (f.activeIngredients.length !== wanted.length) return false;
  const actual = new Map(f.activeIngredients.map((i) => [i.normalized, formatStrength(i.strength)]));
  return wanted.every(([name, strength]) => actual.get(name) === strength);
}

/** The inactive ingredients a label prints, compared by words only (case, commas and spacing aside). */
const inactiveWords = (f: CatalogFormulation) =>
  (f.labelSections.inactive_ingredients ?? []).join(" ").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * One catalog row from the labels matching the spec: text from one representative label, NDCs merged from
 * it and every other match that prints the same inactive ingredients. Flavors and versions with other
 * inactive ingredients stay their own rows: the card's allergy answer is the inactive ingredients.
 */
export function buildSeedRow(spec: SeedSpec, formulations: CatalogFormulation[]): CatalogFormulation | null {
  const matches = formulations.filter((f) => matchesSpec(f, spec));
  if (matches.length === 0) return null;
  const preferred = spec.preferNdc ? ndc11FromHyphenated(spec.preferNdc) : null;
  const newestFirst = [...matches].sort((a, b) => (b.labelEffectiveDate ?? "").localeCompare(a.labelEffectiveDate ?? ""));
  const rep = (preferred && matches.find((m) => m.ndcPackages.includes(preferred))) || newestFirst[0];
  const same = matches.filter((m) => inactiveWords(m) === inactiveWords(rep));
  return {
    ...rep,
    slug: spec.slug,
    brandName: spec.brandName,
    ndcPackages: [...new Set(same.flatMap((m) => m.ndcPackages))].sort(),
  };
}

export function fictionalCatalogRows(): CatalogFormulation[] {
  return FICTIONAL_FORMULATIONS.map((f) => {
    const row: CatalogFormulation & { ndc10?: string; upcA?: string; reviewed?: boolean } = { ...f };
    delete row.ndc10;
    delete row.upcA;
    delete row.reviewed;
    return row;
  });
}

type Row = Database["public"]["Tables"]["formulations"]["Row"];
type Insert = Database["public"]["Tables"]["formulations"]["Insert"];

/**
 * The seed-owned columns that differ from the live row. label_sections, labeler_name and source_links are
 * left out: `import:otc --enrich-reviewed` owns them on hand-checked rows (the seed resets them until then).
 */
export function changedColumns(next: Insert, live: Partial<Row>): string[] {
  const columns = [
    "brand_name",
    "generic_name",
    "dosage_form",
    "ndc_packages",
    "active_ingredients",
    "directions_text",
    "max_24h_text",
    "warnings_quotes",
    "dosage_table_html",
    "openfda_set_id",
    "label_effective_date",
  ] as const;
  // jsonb comes back with its keys reordered: compare with keys sorted.
  const canonical = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(canonical) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canonical(x)])) : (v ?? null);
  const norm = (column: string, v: unknown) => JSON.stringify(canonical(column === "ndc_packages" && Array.isArray(v) ? [...v].sort() : v));
  return columns.filter((c) => norm(c, next[c]) !== norm(c, live[c]));
}

function describeRow(r: CatalogFormulation, labels: string[]): string {
  const strengths = r.activeIngredients.map((i) => `${i.name} ${formatStrength(i.strength)}`).join(" + ");
  const extras = `24-h max: ${r.max24hText ?? "none"} | ${r.warningsQuotes.length} warnings | table: ${r.dosageTableHtml ? "yes" : "no"}`;
  const from = labels.length ? `\n    text from ${r.openfdaSetId} (${r.labelerName}, ${r.labelEffectiveDate}); NDCs from ${labels.length} label(s): ${labels.join(", ")}` : "";
  return `- ${r.slug} | ${r.brandName} | ${r.dosageForm} | ${strengths} | ${r.ndcPackages.length} NDCs | ${extras}${from}`;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const fetched = new Map<string, { labels: FdaLabel[]; products: NdcProduct[] }>();
  const rows = fictionalCatalogRows();
  const groupedLabels = new Map<string, string[]>();
  const nyquil: CatalogFormulation[] = [];
  for (const spec of SEED_SPECS) {
    const key = `${spec.search}|${spec.limit ?? 100}`;
    if (!fetched.has(key)) {
      const labels = (await searchLabels(spec.search, spec.limit ?? 100, 20_000)) as FdaLabel[];
      const products = await ndcProductsByProductNdc(labels.flatMap(productNdcsOf));
      fetched.set(key, { labels, products });
    }
    const { labels, products } = fetched.get(key)!;
    const blockless = spec.ndcProducts ? await ndcProductsByProductNdc(spec.ndcProducts) : [];
    if (spec.ndcProducts && blockless.length !== new Set(spec.ndcProducts).size) {
      throw new Error(`Seed spec ${spec.slug}: NDC Directory has ${blockless.length} of its ${spec.ndcProducts.length} products`);
    }
    const formulations = seedFormulations(labels, products, blockless);
    if (spec.search === NYQUIL && nyquil.length === 0) nyquil.push(...formulations);
    const row = buildSeedRow(spec, formulations);
    if (!row) throw new Error(`No openFDA label matched seed spec ${spec.slug}`);
    const matched = formulations.filter((f) => matchesSpec(f, spec));
    const grouped = (f: CatalogFormulation) => f.ndcPackages.some((n) => row.ndcPackages.includes(n));
    groupedLabels.set(row.slug, [...new Set(matched.filter(grouped).map((f) => f.openfdaSetId ?? "?"))]);
    const apart = [...new Set(matched.filter((f) => !grouped(f)).map((f) => `${f.openfdaSetId} (${f.brandName}, ${f.labelerName})`))];
    if (apart.length) console.log(`  ${row.slug}: kept apart (other inactive ingredients): ${apart.join("; ")}`);
    rows.push(row);
  }

  // Every single-product NyQuil + acetaminophen formulation openFDA returns must be covered.
  const nyquilSpecs = SEED_SPECS.filter((s) => s.search === NYQUIL);
  for (const f of nyquil) {
    if (!nyquilSpecs.some((s) => matchesSpec(f, s))) console.warn(`! NyQuil formulation not covered by a seed spec: ${f.brandName} (${f.openfdaSetId})`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const reviewedAt = new Date().toISOString();
  const inserts = rows.map((r) => formulationToRow(r, reviewedAt));

  // What this run changes, read with the publishable key (the catalog is public).
  if (url && publishable) {
    const reader = createClient<Database>(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: live, error } = await reader.from("formulations").select("*").in("slug", inserts.map((r) => r.slug));
    if (error) throw error;
    const bySlug = new Map(live.map((r) => [r.slug, r]));
    console.log(`Slugs this run writes (${inserts.length}):`);
    for (const next of inserts) {
      const before = bySlug.get(next.slug);
      const changed = before ? changedColumns(next, before) : [];
      const status = !before ? "NEW" : before.reviewed_at === null ? "NOW HAND-CHECKED" : changed.length ? "CHANGED" : "unchanged";
      const dropped = (before?.ndc_packages ?? []).filter((n) => !next.ndc_packages?.includes(n));
      console.log(`  ${status.padEnd(16)} ${next.slug}${changed.length ? ` (${changed.join(", ")})` : ""}${dropped.length ? ` — drops NDCs ${dropped.join(" ")}` : ""}`);
    }
    for (const next of inserts) {
      const ndcs = next.ndc_packages ?? [];
      if (next.is_fictional || ndcs.length === 0) continue;
      const { data: overlap, error: e } = await reader
        .from("formulations")
        .select("slug, brand_name, labeler_name, ndc_packages")
        .overlaps("ndc_packages", ndcs)
        .is("reviewed_at", null);
      if (e) throw e;
      for (const o of overlap) {
        const lost = o.ndc_packages.filter((n) => !ndcs.includes(n));
        console.log(
          `  shares an NDC with ${next.slug}; the next import skips it and --prune deletes it: ${o.slug} (${o.brand_name}, ${o.labeler_name})${lost.length ? ` — ! its NDCs ${lost.join(" ")} are on no seed row` : ""}`,
        );
      }
    }
  }

  if (dryRun) {
    console.log(`Dry run: ${rows.length} formulations (nothing written)`);
    rows.forEach((r) => console.log(describeRow(r, groupedLabels.get(r.slug) ?? [])));
    return;
  }

  if (!url || !secret) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (.env.local)");
  const admin = createClient<Database>(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.from("formulations").upsert(inserts, { onConflict: "slug" }).select("slug");
  if (error) throw error;

  console.log(`Upserted ${data.length} formulations:`);
  rows.forEach((r) => console.log(describeRow(r, groupedLabels.get(r.slug) ?? [])));
}

if (!process.env.VITEST) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
