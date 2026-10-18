// Seeds the `formulations` catalog: the fictional Calmora demo products plus a hand-checked list of
// real acetaminophen oral OTC formulations pulled from openFDA. Labels that are the same
// formulation (same ingredients, strengths and form — e.g. relabelers and store brands) are
// grouped into one row with every package NDC. Idempotent: upserts on `slug`.
//
//   npm run seed                (reads .env.local; SUPABASE_SECRET_KEY bypasses RLS)
//   npm run seed -- --dry-run   (fetch and print the rows, write nothing)
import { createClient } from "@supabase/supabase-js";
import { FICTIONAL_FORMULATIONS } from "@/data/fictional-formulations";
import { formatStrength } from "@/lib/domain/fields";
import { ndc11FromHyphenated } from "@/lib/ndc";
import { formulationToRow, labelToFormulation, searchLabels, type CatalogFormulation } from "@/lib/openfda";
import type { Database } from "@/lib/supabase/database.types";

export type SeedSpec = {
  slug: string;
  /** Display name for the grouped formulation. */
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
};

const NYQUIL = 'openfda.brand_name:"nyquil" AND active_ingredient:acetaminophen';
const CHILDRENS_TYLENOL = 'openfda.brand_name:"childrens tylenol" AND active_ingredient:"160 mg"';
const STORE_CHILDRENS = 'openfda.generic_name:"acetaminophen" AND openfda.brand_name:"childrens" AND active_ingredient:"160 mg"';

export const SEED_SPECS: SeedSpec[] = [
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
];

export function matchesSpec(f: CatalogFormulation, spec: SeedSpec): boolean {
  if (f.dosageForm !== spec.dosageForm) return false;
  if (spec.excludeBrand?.test(f.brandName)) return false;
  const wanted = Object.entries(spec.strengths);
  if (f.activeIngredients.length !== wanted.length) return false;
  const actual = new Map(f.activeIngredients.map((i) => [i.normalized, formatStrength(i.strength)]));
  return wanted.every(([name, strength]) => actual.get(name) === strength);
}

/** One catalog row from every label matching the spec: NDCs merged, text from one representative label. */
export function buildSeedRow(spec: SeedSpec, formulations: CatalogFormulation[]): CatalogFormulation | null {
  const matches = formulations.filter((f) => matchesSpec(f, spec));
  if (matches.length === 0) return null;
  const preferred = spec.preferNdc ? ndc11FromHyphenated(spec.preferNdc) : null;
  const newestFirst = [...matches].sort((a, b) => (b.labelEffectiveDate ?? "").localeCompare(a.labelEffectiveDate ?? ""));
  const rep = (preferred && matches.find((m) => m.ndcPackages.includes(preferred))) || newestFirst[0];
  return {
    ...rep,
    slug: spec.slug,
    brandName: spec.brandName,
    ndcPackages: [...new Set(matches.flatMap((m) => m.ndcPackages))].sort(),
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

function describeRow(r: CatalogFormulation): string {
  const strengths = r.activeIngredients.map((i) => `${i.name} ${formatStrength(i.strength)}`).join(" + ");
  const extras = `24-h max: ${r.max24hText ?? "none"} | ${r.warningsQuotes.length} warnings | table: ${r.dosageTableHtml ? "yes" : "no"}`;
  return `- ${r.slug} | ${r.brandName} | ${r.dosageForm} | ${strengths} | ${r.ndcPackages.length} NDCs | ${extras}`;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const bySearch = new Map<string, CatalogFormulation[]>();
  const rows = fictionalCatalogRows();
  for (const spec of SEED_SPECS) {
    const key = `${spec.search}|${spec.limit ?? 100}`;
    if (!bySearch.has(key)) {
      const labels = await searchLabels(spec.search, spec.limit ?? 100, 20_000);
      bySearch.set(key, labels.map(labelToFormulation).filter((f): f is CatalogFormulation => f !== null));
    }
    const row = buildSeedRow(spec, bySearch.get(key)!);
    if (!row) throw new Error(`No openFDA label matched seed spec ${spec.slug}`);
    rows.push(row);
  }

  // Every single-product NyQuil + acetaminophen formulation openFDA returns must be covered.
  const nyquilSpecs = SEED_SPECS.filter((s) => s.search === NYQUIL);
  for (const f of bySearch.get(`${NYQUIL}|100`) ?? []) {
    if (!nyquilSpecs.some((s) => matchesSpec(f, s))) {
      console.warn(`! NyQuil formulation not covered by a seed spec: ${f.brandName} (${f.slug})`);
    }
  }

  if (dryRun) {
    console.log(`Dry run: ${rows.length} formulations (nothing written)`);
    rows.forEach((r) => console.log(describeRow(r)));
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (.env.local)");
  const admin = createClient<Database>(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const reviewedAt = new Date().toISOString();
  const { data, error } = await admin
    .from("formulations")
    .upsert(
      rows.map((r) => formulationToRow(r, reviewedAt)),
      { onConflict: "slug" },
    )
    .select("slug");
  if (error) throw error;

  console.log(`Upserted ${data.length} formulations:`);
  rows.forEach((r) => console.log(describeRow(r)));
}

if (!process.env.VITEST) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
