// openFDA drug labels → catalog formulations. The mapper is pure; the fetchers call the public
// API at api.fda.gov (no key needed). No "server-only" here: scripts/seed-catalog.ts uses it too.
import DOMPurify from "isomorphic-dompurify";
import type { CatalogIngredient, Formulation } from "@/lib/domain/schema";
import { normalizeIngredient } from "@/lib/domain/ingredients";
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
    generic_name?: string[];
    route?: string[];
    product_type?: string[];
    package_ndc?: string[];
    substance_name?: string[];
    upc?: string[]; // 13 digits, leading 0: "0300450449108"
  };
  [section: string]: unknown;
};

export type CatalogFormulation = Omit<Formulation, "id">;

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

const BULLETS = /[■●•▪◼]/g;

/** Collapse whitespace and repeated headings ("Directions Directions", "Liver warning Liver warning:"). */
function tidy(text: string): string {
  return text
    .replace(/[​ ]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b([A-Z][a-z]+(?: [a-z]+){0,3}) \1\b/g, "$1")
    .trim();
}

function sentenceCase(text: string): string {
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
function parseIngredients(label: OpenFdaLabel): { ingredients: CatalogIngredient[]; dosageForm: string } | null {
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

function parseDirections(label: OpenFdaLabel): string | null {
  const text = tidy((label.dosage_and_administration ?? []).join(" "))
    .replace(/^(directions\s*:?\s*)+/i, "")
    .replace(/\s*■\s*/g, " • ")
    .trim()
    .replace(/^•\s*/, "");
  return text || null;
}

/** The directions' own 24-hour limit, verbatim: "do not exceed 8 caplets per 24 hrs". */
function parseMax24h(directions: string | null): string | null {
  if (!directions) return null;
  const m = directions.match(
    /\b(do not (?:exceed|give more than|take more than|use more than)[^.•]{0,60}?\b24\s*(?:hours|hrs?)\b)/i,
  );
  return m ? m[1].trim() : null;
}

const WARNING_HEADINGS =
  /\s+(?=(?:Liver warning|Allergy [Aa]lert|Sore throat warning|Overdose warning|Do not use|Ask a doctor|When using this product|Stop use|Keep out of reach|If pregnant)\b)/;

/** Verbatim warning sentences that name one of the product's active ingredients. */
function parseWarningsQuotes(label: OpenFdaLabel, ingredients: CatalogIngredient[]): string[] {
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
  return DOMPurify.sanitize(separated, { ALLOWED_TAGS: TABLE_TAGS, ALLOWED_ATTR: ["colspan", "rowspan", "scope"] })
    .replace(/<caption>\s*<\/caption>/g, "")
    .trim();
}

function isHomeopathic(label: OpenFdaLabel): boolean {
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
  };
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
    reviewed_at: reviewedAt,
  };
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

const LABEL_ENDPOINT = "https://api.fda.gov/drug/label.json";

/** openFDA search matching any of the given hyphenated NDCs, or the 13-digit UPC when given. */
export function ndcSearchQuery(hyphenatedNdcs: string[], upc: string | null = null): string {
  const terms = hyphenatedNdcs.map((n) => `openfda.package_ndc:"${n}"`);
  if (upc) terms.push(`openfda.upc:"${upc}"`);
  return terms.join(" OR ");
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

/** Labels whose packages carry any of the given hyphenated NDCs, or the given UPC. */
export async function fetchLabelsByNdc(
  hyphenatedNdcs: string[],
  upc: string | null,
  timeoutMs?: number,
): Promise<OpenFdaLabel[]> {
  if (hyphenatedNdcs.length === 0 && !upc) return [];
  return searchLabels(ndcSearchQuery(hyphenatedNdcs, upc), 5, timeoutMs);
}
