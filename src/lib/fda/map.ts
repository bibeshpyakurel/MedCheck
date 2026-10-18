// One FDA label (+ its NDC Directory products) → one catalog formulation, or a counted reject. Pure.
// Spec: docs/superpowers/specs/2026-10-17-otc-catalog-design.md §1.
//
// Strengths come from the NDC Directory (structured); the per-unit of a count strength comes from the
// label's own "(in each caplet)" wording when it narrows the NDC form, else from the NDC form. Text
// (directions, 24-hour limit, warnings, dosing table, card sections) comes from the label.
import type { CatalogIngredient, Strength } from "@/lib/domain/schema";
import { normalizeIngredient } from "@/lib/domain/ingredients";
import { ndc11FromHyphenated } from "@/lib/ndc";
import {
  dailyMedUrl,
  isHomeopathic,
  parseDirections,
  parseIngredients,
  parseMax24h,
  parseWarningsQuotes,
  sanitizeDosageTable,
  sentenceCase,
  tidy,
  type CatalogFormulation,
} from "@/lib/openfda";
import { dosageFormFor, refineForm, type FormInfo } from "./dosage-form";
import { joinLabel, type JoinMethod, type NdcIndex } from "./join";
import { labelSections } from "./sections";
import { labelPers, parseNdcStrength, type NdcStrength } from "./strength";
import { IMPORT_ROUTES, type FdaLabel, type NdcProduct } from "./types";

export const REJECT_REASONS = [
  "not_otc", // label isn't a HUMAN OTC DRUG
  "route", // no oral, sublingual or buccal route
  "homeopathic",
  "kit_or_multi_product", // a kit, or products on other routes under the same label
  "not_finished",
  "no_join_no_strength", // no NDC product joined and no strength readable from the label text
  "unknown_unit", // a strength unit outside the contract's amountUnitSchema
  "unreadable_strength",
  "unclear_per_unit", // a count strength on a liquid/semisolid with no volume on the label
  "multiple_strengths", // one label, products with different strengths (e.g. nicotine 2 mg and 4 mg)
  "mixed_dosage_forms",
  "unmapped_dosage_form",
  "no_name",
  "reviewed_ndc", // a package NDC already on a hand-checked row — reviewed rows win
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export type MapResult =
  | { ok: true; formulation: CatalogFormulation; join: JoinMethod }
  | { ok: false; reason: RejectReason; join: JoinMethod };

export function otcSlug(setId: string): string {
  return `otc-${setId}`;
}

const ALLOWED_ROUTES = new Set<string>(IMPORT_ROUTES);
const HOMEOPATHIC_UNIT = /\[(?:hp|kp)_/;

function titleCase(text: string): string {
  return text.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

function trimNumber(n: number): string {
  return String(Number(n.toFixed(4)));
}

/** True when the label prints "<amount> <unit>" (e.g. "5 mg"), so a restated strength is the label's own. */
function labelPrints(text: string, amount: number, unit: string): boolean {
  const n = trimNumber(amount).replace(".", "\\.");
  return new RegExp(`(?<![\\d.])${n}\\s*${unit}\\b`, "i").test(text);
}

function strengthFor(s: NdcStrength, form: FormInfo, labelVolume: number | null, activeText: string): Strength | "unclear_per_unit" {
  if (s.per.kind === "count") {
    if (form.kind === "solid") return { amount: s.amount, unit: s.unit, perAmount: s.per.amount, perUnit: form.per ?? form.form };
    // "650 mg/1" on a syrup: the "1" is a dose; only the label can say what volume that is.
    if (labelVolume !== null && s.per.amount === 1) return { amount: s.amount, unit: s.unit, perAmount: labelVolume, perUnit: "mL" };
    return "unclear_per_unit";
  }
  const strength: Strength = { amount: s.amount, unit: s.unit, perAmount: s.per.amount, perUnit: s.per.unit };
  // "1 mg/mL" where the label prints "(in each 5 mL) … 5 mg": keep the label's own statement.
  if (s.per.unit === "mL" && labelVolume !== null && labelVolume !== s.per.amount) {
    const restated = (s.amount * labelVolume) / s.per.amount;
    if (labelPrints(activeText, restated, s.unit)) return { ...strength, amount: Number(trimNumber(restated)), perAmount: labelVolume };
  }
  return strength;
}

function ingredientKey(p: NdcProduct): string {
  return (p.active_ingredients ?? [])
    .map((i) => `${normalizeIngredient(i.name ?? "")}=${(i.strength ?? "").replace(/\s+/g, "")}`)
    .sort()
    .join("|");
}

/** Sort ingredients the way the label's Active ingredient text lists them. */
function labelOrder(ingredients: CatalogIngredient[], activeText: string): CatalogIngredient[] {
  const lower = activeText.toLowerCase();
  const at = (i: CatalogIngredient) => {
    const word = i.normalized.split(" ")[0] || i.name.toLowerCase().split(" ")[0];
    const index = lower.indexOf(word);
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  return ingredients.map((i, n) => ({ i, n, at: at(i) })).sort((a, b) => a.at - b.at || a.n - b.n).map((x) => x.i);
}

export function mapLabel(label: FdaLabel, index: NdcIndex): MapResult {
  const o = label.openfda ?? {};
  const { method: join, products } = joinLabel(label, index);
  const reject = (reason: RejectReason): MapResult => ({ ok: false, reason, join });

  if (!(o.product_type ?? []).includes("HUMAN OTC DRUG")) return reject("not_otc");
  if (!(o.route ?? []).some((r) => ALLOWED_ROUTES.has(r))) return reject("route");
  const strengthsText = products.flatMap((p) => (p.active_ingredients ?? []).map((i) => i.strength ?? ""));
  if (isHomeopathic(label) || strengthsText.some((s) => HOMEOPATHIC_UNIT.test(s))) return reject("homeopathic");
  if (
    products.some(
      (p) =>
        (p.dosage_form ?? "").toUpperCase() === "KIT" ||
        (p.active_ingredients ?? []).length === 0 ||
        !(p.route ?? []).some((r) => ALLOWED_ROUTES.has(r)),
    )
  ) {
    return reject("kit_or_multi_product");
  }
  if (products.some((p) => p.finished === false)) return reject("not_finished");

  const activeText = tidy((label.active_ingredient ?? []).join(" "));
  const pers = labelPers(activeText);
  const nouns = pers.flatMap((p) => (p.kind === "count" ? [p.noun] : []));
  const volumes = [...new Set(pers.flatMap((p) => (p.kind === "volume" ? [p.amount] : [])))];
  const labelVolume = volumes.length === 1 ? volumes[0] : null;

  let ingredients: CatalogIngredient[];
  let dosageForm: string;
  if (products.length === 0) {
    const parsed = parseIngredients(label);
    if (!parsed) return reject("no_join_no_strength");
    ingredients = parsed.ingredients;
    dosageForm = parsed.dosageForm;
  } else {
    if (new Set(products.map(ingredientKey)).size > 1) return reject("multiple_strengths");
    const forms = products.map((p) => dosageFormFor(p.dosage_form ?? ""));
    if (forms.some((f) => f === null)) return reject("unmapped_dosage_form");
    if (new Set(forms.map((f) => f!.form)).size > 1) return reject("mixed_dosage_forms");
    const form = refineForm(forms[0]!, nouns);
    dosageForm = form.form;

    ingredients = [];
    for (const i of products[0].active_ingredients ?? []) {
      const parsed = parseNdcStrength(i.strength ?? "");
      if (!parsed.ok) return reject(parsed.reason === "unknown_unit" ? "unknown_unit" : "unreadable_strength");
      const strength = strengthFor(parsed.value, form, labelVolume, activeText);
      if (strength === "unclear_per_unit") return reject("unclear_per_unit");
      const name = titleCase((i.name ?? "").trim());
      if (!name) return reject("unreadable_strength");
      ingredients.push({ name, normalized: normalizeIngredient(name), strength });
    }
    ingredients = labelOrder(ingredients, activeText);
  }

  const brandName = (o.brand_name?.[0] ?? products[0]?.brand_name ?? "").trim();
  if (!brandName || !label.set_id) return reject("no_name");

  const ndcPackages = [
    ...new Set(
      [...products.flatMap((p) => (p.packaging ?? []).map((k) => k.package_ndc ?? "")), ...(o.package_ndc ?? [])]
        .map(ndc11FromHyphenated)
        .filter((n): n is string => n !== null),
    ),
  ];
  const directionsText = parseDirections(label);
  const table = ((label.dosage_and_administration_table as unknown[] | undefined) ?? []).filter((t) => typeof t === "string").join("\n");
  const dosageTableHtml = table.includes("<table") ? sanitizeDosageTable(table) || null : null;
  const date = label.effective_time?.match(/^(\d{4})(\d{2})(\d{2})/);
  const generic = o.generic_name?.[0] ?? products[0]?.generic_name ?? ingredients.map((i) => i.name).join(", ");

  return {
    ok: true,
    join,
    formulation: {
      slug: otcSlug(label.set_id),
      brandName,
      genericName: sentenceCase(generic),
      dosageForm,
      isFictional: false,
      ndcPackages,
      activeIngredients: ingredients,
      directionsText,
      max24hText: parseMax24h(directionsText),
      warningsQuotes: parseWarningsQuotes(label, ingredients),
      dosageTableHtml,
      source: "openfda",
      openfdaSetId: label.set_id,
      labelEffectiveDate: date ? `${date[1]}-${date[2]}-${date[3]}` : null,
      labelerName: (products[0]?.labeler_name ?? o.manufacturer_name?.[0] ?? "").trim() || null,
      labelSections: labelSections(label),
      sourceLinks: [{ label: "FDA label (DailyMed)", url: dailyMedUrl(label.set_id) }],
    },
  };
}

export type ImportResult = {
  rows: CatalogFormulation[];
  rejects: Partial<Record<RejectReason, number>>;
  /** Up to 5 "brand (set id)" per reject reason, for the report. */
  rejectExamples: Partial<Record<RejectReason, string[]>>;
  joins: Record<JoinMethod, number>;
  /** Mapped, then skipped because a package NDC is on a hand-checked row. */
  skippedForReviewed: CatalogFormulation[];
};

/** Map every label; labels sharing a package NDC with a reviewed row are skipped (reviewed rows win). */
export function importLabels(labels: FdaLabel[], index: NdcIndex, reviewedNdcs: Set<string>): ImportResult {
  const result: ImportResult = { rows: [], rejects: {}, rejectExamples: {}, joins: { spl_id: 0, package_ndc: 0, none: 0 }, skippedForReviewed: [] };
  const count = (reason: RejectReason, label: FdaLabel) => {
    result.rejects[reason] = (result.rejects[reason] ?? 0) + 1;
    const examples = (result.rejectExamples[reason] ??= []);
    if (examples.length < 5) examples.push(`${label.openfda?.brand_name?.[0] ?? "?"} (${label.set_id})`);
  };
  const seen = new Set<string>();
  for (const label of labels) {
    if (label.set_id && seen.has(label.set_id)) continue;
    if (label.set_id) seen.add(label.set_id);
    const mapped = mapLabel(label, index);
    result.joins[mapped.join]++;
    if (!mapped.ok) {
      count(mapped.reason, label);
      continue;
    }
    if (mapped.formulation.ndcPackages.some((n) => reviewedNdcs.has(n))) {
      count("reviewed_ndc", label);
      result.skippedForReviewed.push(mapped.formulation);
      continue;
    }
    result.rows.push(mapped.formulation);
  }
  return result;
}
