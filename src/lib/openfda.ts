// openFDA drug labels → catalog formulations. The mapper is pure; the fetchers call the public
// API at api.fda.gov (no key needed). No "server-only" here: scripts/seed-catalog.ts uses it too.
// sanitize-html (htmlparser2), not DOMPurify: isomorphic-dompurify loads jsdom, which crashes on
// Vercel's runtime (ERR_REQUIRE_ESM) and took the label page down with it.
import sanitizeHtml from "sanitize-html";
import type { CatalogIngredient, Formulation } from "@/lib/domain/schema";
import { normalizeIngredient } from "@/lib/domain/ingredients";
import type { NdcProduct } from "@/lib/fda/types";
import type { Database, Json } from "@/lib/supabase/database.types";
import { ndc11FromHyphenated } from "./ndc";

/** The parts of an openFDA `drug/label` result we read. Every section is an array of strings. */
export type OpenFdaLabel = {
  set_id?: string;
  effective_time?: string; // "20251001"
  active_ingredient?: string[];
  dosage_and_administration?: string[];
  dosage_and_administration_table?: string[];
  warnings?: string[];
  do_not_use?: string[];
  openfda?: {
    brand_name?: string[];
    manufacturer_name?: string[];
    generic_name?: string[];
    route?: string[];
    product_type?: string[];
    package_ndc?: string[];
    substance_name?: string[];
    upc?: string[]; // 13 digits, leading 0: "0300450449108"
  };
  [section: string]: unknown;
};

export type CatalogFormulation = Omit<Formulation, "id" | "reviewed">;

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

const BULLETS = /[■●•▪◼]/g;

/** Collapse whitespace and repeated headings ("Directions Directions", "Liver warning Liver warning:"). */
export function tidy(text: string): string {
  return text
    .replace(/[​ ]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b([A-Z][a-z]+(?: [a-z]+){0,3}) \1\b/g, "$1")
    .trim();
}

export function sentenceCase(text: string): string {
  const lower = text.trim().toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** "(in each 5 mL = 1 teaspoonful)" → per 5 mL, liquid; "(in each caplet)" → per 1 caplet. */
function parsePer(activeText: string): { perAmount: number; perUnit: string; dosageForm: string; end: number } | null {
  const m = activeText.match(/\(\s*in each\s+([^)=]+?)\s*(?:=[^)]*)?\)/i);
  if (!m || m.index === undefined) return null;
  const end = m.index + m[0].length;
  const volume = m[1].match(/^(\d+(?:\.\d+)?)\s*ml$/i);
  if (volume) return { perAmount: Number(volume[1]), perUnit: "mL", dosageForm: "liquid", end };
  const unit = m[1].toLowerCase().replace(/s$/, "").trim();
  return { perAmount: 1, perUnit: unit, dosageForm: unit, end };
}

/**
 * Active ingredients with strengths, in label order. Uses openFDA's `substance_name` list to know
 * which names to look for, then reads "<name as printed> <amount> mg" from the Drug Facts text.
 * Null when any listed substance has no readable strength.
 */
export function parseIngredients(label: OpenFdaLabel): { ingredients: CatalogIngredient[]; dosageForm: string } | null {
  const text = tidy(label.active_ingredient?.[0] ?? "");
  const per = parsePer(text);
  const substances = [...new Set(label.openfda?.substance_name ?? [])];
  if (!per || substances.length === 0) return null;
  const body = text.slice(per.end);

  const found: { index: number; ingredient: CatalogIngredient }[] = [];
  for (const substance of substances) {
    const firstWord = substance.split(/\s+/)[0];
    const re = new RegExp(`\\b(${escapeRegExp(firstWord)}[A-Za-z .,-]{0,40}?)\\s*(\\d+(?:\\.\\d+)?)\\s*(mg|mcg|g)\\b`, "i");
    const m = body.match(re);
    if (!m || m.index === undefined) return null;
    const name = m[1].replace(/[\s.,-]+$/, "");
    found.push({
      index: m.index,
      ingredient: {
        name,
        normalized: normalizeIngredient(name),
        strength: {
          amount: Number(m[2]),
          unit: m[3].toLowerCase() as "mg" | "mcg" | "g",
          perAmount: per.perAmount,
          perUnit: per.perUnit,
        },
      },
    });
  }
  found.sort((a, b) => a.index - b.index);
  return { ingredients: found.map((f) => f.ingredient), dosageForm: per.dosageForm };
}

export function parseDirections(label: OpenFdaLabel): string | null {
  const text = tidy((label.dosage_and_administration ?? []).join(" "))
    .replace(/^(directions\s*:?\s*)+/i, "")
    .replace(/\s*■\s*/g, " • ")
    .trim()
    .replace(/^•\s*/, "");
  return text || null;
}

/** The directions' own 24-hour limit, verbatim: "do not exceed 8 caplets per 24 hrs". */
export function parseMax24h(directions: string | null): string | null {
  if (!directions) return null;
  const m = directions.match(
    /\b(do not (?:exceed|give more than|take more than|use more than)[^.•]{0,60}?\b24\s*(?:hours|hrs?)\b)/i,
  );
  return m ? m[1].trim() : null;
}

const WARNING_HEADINGS =
  /\s+(?=(?:Liver warning|Allergy [Aa]lert|Sore throat warning|Overdose warning|Do not use|Ask a doctor|When using this product|Stop use|Keep out of reach|If pregnant)\b)/;

/** Verbatim warning sentences that name one of the product's active ingredients. */
export function parseWarningsQuotes(label: OpenFdaLabel, ingredients: CatalogIngredient[]): string[] {
  const words = [...new Set(ingredients.map((i) => i.normalized.split(" ")[0]))];
  const sections = [...(label.warnings ?? []), ...(label.do_not_use ?? [])];
  const quotes: string[] = [];
  for (const section of sections) {
    const text = tidy(section.replace(BULLETS, " ")).replace(/^warnings\s+/i, "");
    for (const piece of text.split(/(?<=[.!?])\s+/).flatMap((s) => s.split(WARNING_HEADINGS))) {
      const quote = piece.trim();
      const lower = quote.toLowerCase();
      if (quote.length < 12 || quote.length > 400) continue;
      if (!words.some((w) => lower.includes(w))) continue;
      if (!quotes.includes(quote)) quotes.push(quote);
    }
  }
  return quotes.slice(0, 6);
}

const TABLE_TAGS = ["table", "caption", "colgroup", "col", "thead", "tbody", "tfoot", "tr", "th", "td", "br", "sup", "sub", "b", "strong", "i", "em"];

/** Dosing-table HTML with only table structure kept: no scripts, handlers, styles or SPL tags. */
export function sanitizeDosageTable(html: string): string {
  // SPL puts several <paragraph>/<item> elements in one cell; keep them on separate lines.
  const separated = html.replace(/<\/(paragraph|item)>\s*<(paragraph|item)\b[^>]*>/gi, "<br>");
  return sanitizeHtml(separated, {
    allowedTags: TABLE_TAGS,
    allowedAttributes: { "*": ["colspan", "rowspan", "scope"] },
  })
    .replace(/<br \/>/g, "<br>")
    .replace(/<caption>\s*<\/caption>/g, "")
    .trim();
}

export function isHomeopathic(label: OpenFdaLabel): boolean {
  const text = [
    ...(label.openfda?.product_type ?? []),
    ...(label.active_ingredient ?? []),
    ...((label.package_label_principal_display_panel as string[] | undefined) ?? []),
  ].join(" ");
  return /homeopathic|\bHPUS\b|\b\d+\s?(?:X|C|CK|LM)\b/.test(text);
}

/**
 * One openFDA label → a catalog formulation, or null when it isn't a single-product oral OTC
 * human drug with readable strengths (homeopathic, topical, prescription, multi-product kits).
 */
export function labelToFormulation(label: OpenFdaLabel): CatalogFormulation | null {
  const o = label.openfda;
  if (!o) return null;
  if (!(o.product_type ?? []).includes("HUMAN OTC DRUG")) return null;
  if (!(o.route ?? []).includes("ORAL")) return null;
  if (isHomeopathic(label)) return null;
  if ((label.active_ingredient ?? []).length !== 1) return null; // kits list one section per product

  const parsed = parseIngredients(label);
  const brandName = o.brand_name?.[0]?.trim();
  if (!parsed || !brandName) return null;

  const directionsText = parseDirections(label);
  const table = (label.dosage_and_administration_table ?? []).join("\n");
  const dosageTableHtml = table.includes("<table") ? sanitizeDosageTable(table) : null;
  const setId = label.set_id ?? null;
  const date = label.effective_time?.match(/^(\d{4})(\d{2})(\d{2})/);

  return {
    slug: `${slugify(`${brandName} ${parsed.dosageForm}`)}-${(setId ?? "label").slice(0, 8)}`,
    brandName,
    genericName: sentenceCase(o.generic_name?.[0] ?? parsed.ingredients.map((i) => i.name).join(", ")),
    dosageForm: parsed.dosageForm,
    isFictional: false,
    ndcPackages: [...new Set((o.package_ndc ?? []).map(ndc11FromHyphenated).filter((n): n is string => n !== null))],
    activeIngredients: parsed.ingredients,
    directionsText,
    max24hText: parseMax24h(directionsText),
    warningsQuotes: parseWarningsQuotes(label, parsed.ingredients),
    dosageTableHtml: dosageTableHtml || null,
    source: "openfda",
    openfdaSetId: setId,
    labelEffectiveDate: date ? `${date[1]}-${date[2]}-${date[3]}` : null,
    labelerName: o.manufacturer_name?.[0]?.trim() || null,
    labelSections: {},
    sourceLinks: setId ? [{ label: "FDA label (DailyMed)", url: dailyMedUrl(setId) }] : [],
  };
}

/** The label's public page on DailyMed (NLM's home for FDA labels). */
export function dailyMedUrl(setId: string): string {
  return `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${encodeURIComponent(setId)}`;
}

/** A catalog formulation as a `formulations` row for upsert (on `slug`). */
export function formulationToRow(
  f: CatalogFormulation,
  reviewedAt: string | null,
): Database["public"]["Tables"]["formulations"]["Insert"] {
  return {
    slug: f.slug,
    brand_name: f.brandName,
    generic_name: f.genericName,
    dosage_form: f.dosageForm,
    is_fictional: f.isFictional,
    ndc_packages: f.ndcPackages,
    active_ingredients: f.activeIngredients as unknown as Json,
    directions_text: f.directionsText,
    max_24h_text: f.max24hText,
    warnings_quotes: f.warningsQuotes,
    dosage_table_html: f.dosageTableHtml,
    source: f.source,
    openfda_set_id: f.openfdaSetId,
    label_effective_date: f.labelEffectiveDate,
    labeler_name: f.labelerName,
    label_sections: f.labelSections as unknown as Json,
    source_links: f.sourceLinks as unknown as Json,
    reviewed_at: reviewedAt,
  };
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

const LABEL_ENDPOINT = "https://api.fda.gov/drug/label.json";

const NDC_ENDPOINT = "https://api.fda.gov/drug/ndc.json";

/** The 11-digit package NDCs (5-4-2, no hyphens) of NDC Directory products, once each. */
export function packageNdcs(products: NdcProduct[]): string[] {
  const all = products.flatMap((p) => (p.packaging ?? []).map((k) => ndc11FromHyphenated(k.package_ndc ?? "")));
  return [...new Set(all.filter((n): n is string => n !== null))];
}

/**
 * The package NDCs the NDC Directory lists for a 13-digit UPC (`openfda.upc`). Boxes can carry a
 * labeler code the FDA no longer lists (Tylenol prints McNeil's 0045, its label says 50580), so only
 * the UPC finds them. No matches → []. Throws on network errors or timeouts.
 */
export async function packageNdcsForUpc(upc: string, timeoutMs = 4000): Promise<string[]> {
  const url = `${NDC_ENDPOINT}?${new URLSearchParams({ search: `openfda.upc:"${upc}"`, limit: "20" })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`openFDA NDC search failed: ${res.status}`);
  const body = (await res.json()) as { results?: NdcProduct[] };
  return packageNdcs(body.results ?? []);
}

/**
 * NDC Directory products for product NDCs ("50580-472"), 50 per request. No matches → []. Throws on network
 * errors or timeouts.
 */
export async function ndcProductsByProductNdc(productNdcs: string[], timeoutMs = 20_000): Promise<NdcProduct[]> {
  const unique = [...new Set(productNdcs)].filter((n) => /^\d{4,5}-\d{3,4}$/.test(n));
  const products: NdcProduct[] = [];
  for (let i = 0; i < unique.length; i += 50) {
    const search = `product_ndc:(${unique.slice(i, i + 50).map((n) => `"${n}"`).join(" OR ")})`;
    const url = `${NDC_ENDPOINT}?${new URLSearchParams({ search, limit: "1000" })}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`openFDA NDC search failed: ${res.status}`);
    products.push(...(((await res.json()) as { results?: NdcProduct[] }).results ?? []));
  }
  return products;
}

/** Runs an openFDA label search. No matches → []. Throws on network errors or timeouts. */
export async function searchLabels(search: string, limit = 100, timeoutMs = 8000): Promise<OpenFdaLabel[]> {
  const url = `${LABEL_ENDPOINT}?${new URLSearchParams({ search, limit: String(limit) })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (res.status === 404) return []; // openFDA answers "no matches" with 404
  if (!res.ok) throw new Error(`openFDA label search failed: ${res.status}`);
  const body = (await res.json()) as { results?: OpenFdaLabel[] };
  return body.results ?? [];
}
