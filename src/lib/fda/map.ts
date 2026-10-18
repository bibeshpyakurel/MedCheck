// One FDA label (+ its NDC Directory products) → one catalog formulation, or a counted reject. Pure.
// Spec: docs/superpowers/specs/2026-10-17-otc-catalog-design.md §1.
//
// Strengths are the label's own: the amount printed in its "Active ingredient(s)" text, with the label's
// per-quantity ("(in each 30 mL)", "(in each caplet)"). The NDC Directory's structured value only confirms
// it — or supplies the per-quantity when the label prints an amount without one and the NDC amount is the
// same. Anything else is rejected with a reason. Text (directions, 24-hour limit, warnings, dosing table,
// card sections) comes from the label.
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
  type CatalogFormulation,
} from "@/lib/openfda";
import { dosageFormFor, refineForm, type FormInfo } from "./dosage-form";
import { joinLabel, type JoinMethod, type NdcIndex } from "./join";
import { equivalent, findPrinted, labelVolume as labelVolumeOf, strengthIsTraceable, type Printed } from "./label-strength";
import { activeIngredientText, fieldTexts, isPlaceholder, labelSections } from "./sections";
import type { SplSections } from "./spl";
import { labelPers, parseNdcStrength, type NdcStrength } from "./strength";
import { IMPORT_ROUTES, type FdaLabel, type NdcProduct } from "./types";

export const REJECT_REASONS = [
  "not_otc", // label isn't a HUMAN OTC DRUG
  "route", // no oral, sublingual or buccal route
  "homeopathic",
  "kit_or_multi_product", // a kit, or products on other routes under the same label
  "not_finished",
  "placeholder_label", // sections are only heading words ("dosage and admin", "ask a doc")
  "no_join_no_strength", // no NDC product joined and no strength readable from the label text
  "unknown_unit", // an NDC strength unit outside the contract's amountUnitSchema
  "unreadable_strength",
  "strength_not_on_label", // the Active ingredient text prints no amount for an ingredient (or there is none)
  "strength_mismatch", // label and NDC disagree and the label alone doesn't settle it (salt vs ion %, 100% oil)
  "unclear_per_unit", // a count strength on a liquid/semisolid with no volume on the label
  "implausible_strength", // per 1201 capsules, per 108 g …
  "multiple_strengths", // one label, products with different strengths (e.g. nicotine 2 mg and 4 mg)
  "mixed_dosage_forms",
  "unmapped_dosage_form",
  "no_name",
  "untraceable_strength", // whole-run gate: a stored strength isn't the label's printed amount
  "reviewed_ndc", // a package NDC already on a hand-checked row — reviewed rows win
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

/** How a stored strength was settled. */
export type StrengthSource = "label_and_ndc" | "label" | "ndc_per";

export type MapResult =
  | { ok: true; formulation: CatalogFormulation; join: JoinMethod; sources: StrengthSource[] }
  | { ok: false; reason: RejectReason; join: JoinMethod };

export type MapOptions = { spl?: SplSections | null };

export function otcSlug(setId: string): string {
  return `otc-${setId}`;
}

const ALLOWED_ROUTES = new Set<string>(IMPORT_ROUTES);
const HOMEOPATHIC_UNIT = /\[(?:hp|kp)_/;

function titleCase(text: string): string {
  return text.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

const round = (n: number) => Number(n.toFixed(6));

/** A strength no label states: per 1201 capsules, per 108 g of a chewable, per 500 mL. */
export function plausibleStrength(s: Strength): boolean {
  const per = s.perAmount ?? 1;
  if (!(s.amount > 0) || !(per > 0)) return false;
  if (s.perUnit === "mL") return per >= 0.1 && per <= 240;
  if (s.perUnit === "L") return per <= 1;
  if (s.perUnit === "g") return per <= 100;
  if (s.perUnit === "mg") return per <= 1000;
  return per >= 1 && per <= 10; // per tablet, caplet, packet …
}

/** The NDC value as a catalog strength (count strengths take the form's unit; none on a liquid). */
function ndcStrength(s: NdcStrength, form: FormInfo): Strength | null {
  if (s.per.kind === "measure") return { amount: s.amount, unit: s.unit, perAmount: s.per.amount, perUnit: s.per.unit };
  return form.kind === "solid" ? { amount: s.amount, unit: s.unit, perAmount: s.per.amount, perUnit: form.per ?? form.form } : null;
}

/**
 * The label's own statement as a strength. `explicit`: the label alone says it (an amount with its
 * per-quantity, or a percent with its stated w/v or w/w basis). A percent on the form's usual basis needs
 * the NDC value to confirm it. Null when the label gives an amount but no per-quantity (liquids, gels).
 */
function labelStrength(p: Printed, form: FormInfo, volume: number | null): { strength: Strength; explicit: boolean } | null {
  if (p.unit === "%") {
    const basis = p.basis ?? (form.kind === "liquid" ? "w/v" : "w/w");
    if ((basis === "w/v") !== (form.kind === "liquid")) return null; // w/v on a gel, w/w on a liquid: ambiguous
    const strength: Strength = { amount: round(p.amount * 10), unit: "mg", perAmount: 1, perUnit: basis === "w/v" ? "mL" : "g" };
    return { strength, explicit: p.basis !== null };
  }
  const per = p.perVolume ?? volume;
  if (per !== null) return { strength: { amount: p.amount, unit: p.unit, perAmount: per, perUnit: "mL" }, explicit: true };
  if (form.kind === "solid") return { strength: { amount: p.amount, unit: p.unit, perAmount: 1, perUnit: form.per ?? form.form }, explicit: true };
  return null;
}

/** One ingredient's strength from what the label prints, confirmed (or overruled) against the NDC. */
function decideStrength(
  p: Printed,
  ndc: NdcStrength | null,
  form: FormInfo,
  volume: number | null,
): { strength: Strength; source: StrengthSource } | RejectReason {
  const fromNdc = ndc ? ndcStrength(ndc, form) : null;
  const fromLabel = labelStrength(p, form, volume);
  if (fromLabel) {
    if (fromNdc !== null && equivalent(fromNdc, fromLabel.strength)) return { strength: fromLabel.strength, source: "label_and_ndc" };
    if (fromLabel.explicit) return { strength: fromLabel.strength, source: "label" };
    return "strength_mismatch";
  }
  // The label prints only the amount: the NDC may supply the per-quantity when its amount is the same.
  if (p.unit === "%") return "strength_mismatch";
  if (!fromNdc) return "unclear_per_unit";
  if (fromNdc.unit === p.unit && Math.abs(fromNdc.amount - p.amount) <= 1e-6 * Math.max(1, p.amount)) {
    return { strength: fromNdc, source: "ndc_per" };
  }
  return "strength_mismatch";
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
    const word = i.name.toLowerCase().split(" ")[0] || i.normalized.split(" ")[0];
    const index = lower.indexOf(word);
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  return ingredients.map((i, n) => ({ i, n, at: at(i) })).sort((a, b) => a.at - b.at || a.n - b.n).map((x) => x.i);
}

/** "…take only one dose per day (24 hours": extend to the closing parenthesis in the source, else cut before it. */
export function balanceParens(snippet: string | null, source: string | null): string | null {
  if (!snippet) return snippet;
  const open = (snippet.match(/\(/g) ?? []).length - (snippet.match(/\)/g) ?? []).length;
  if (open <= 0) return snippet;
  const at = source?.indexOf(snippet) ?? -1;
  if (source && at >= 0) {
    const close = source.indexOf(")", at + snippet.length);
    if (close >= 0 && close - (at + snippet.length) <= 40) return source.slice(at, close + 1);
  }
  return snippet.slice(0, snippet.lastIndexOf("(")).trim() || null;
}

export function mapLabel(label: FdaLabel, index: NdcIndex, options: MapOptions = {}): MapResult {
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
  if (isPlaceholder(label)) return reject("placeholder_label");

  const activeText = activeIngredientText(label);
  const nouns = labelPers(activeText).flatMap((p) => (p.kind === "count" ? [p.noun] : []));
  const volume = labelVolumeOf(activeText);
  const sources: StrengthSource[] = [];

  let ingredients: CatalogIngredient[];
  let dosageForm: string;
  if (products.length === 0) {
    const parsed = parseIngredients(label);
    if (!parsed) return reject("no_join_no_strength");
    ingredients = parsed.ingredients;
    dosageForm = parsed.dosageForm;
    sources.push(...ingredients.map((): StrengthSource => "label"));
  } else {
    if (new Set(products.map(ingredientKey)).size > 1) return reject("multiple_strengths");
    const forms = products.map((p) => dosageFormFor(p.dosage_form ?? ""));
    if (forms.some((f) => f === null)) return reject("unmapped_dosage_form");
    if (new Set(forms.map((f) => f!.form)).size > 1) return reject("mixed_dosage_forms");
    const form = refineForm(forms[0]!, nouns);
    dosageForm = form.form;

    ingredients = [];
    const ndcIngredients = products[0].active_ingredients ?? [];
    for (const i of ndcIngredients) {
      const ndcName = (i.name ?? "").trim();
      if (!ndcName) return reject("unreadable_strength");
      const parsed = parseNdcStrength(i.strength ?? "");
      if (!parsed.ok && parsed.reason === "unknown_unit") return reject("unknown_unit");
      const others = ndcIngredients.map((x) => (x.name ?? "").trim()).filter((x) => x && x !== ndcName);
      const printed = findPrinted(activeText, ndcName, others);
      if (!printed) return reject("strength_not_on_label");
      const decided = decideStrength(printed, parsed.ok ? parsed.value : null, form, volume);
      if (typeof decided === "string") return reject(decided);
      if (!plausibleStrength(decided.strength)) return reject("implausible_strength");
      sources.push(decided.source);
      const name = printed.baseName ?? titleCase(ndcName);
      ingredients.push({ name, normalized: normalizeIngredient(name), strength: decided.strength });
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
  // Multi-product labels repeat whole blocks in separate entries; use each block once.
  const directionsText = parseDirections({ ...label, dosage_and_administration: fieldTexts(label, "dosage_and_administration") });
  const table = fieldTexts(label, "dosage_and_administration_table").join("\n");
  const dosageTableHtml = table.includes("<table") ? sanitizeDosageTable(table) || null : null;
  const date = label.effective_time?.match(/^(\d{4})(\d{2})(\d{2})/);
  const generic = o.generic_name?.[0] ?? products[0]?.generic_name ?? ingredients.map((i) => i.name).join(", ");

  return {
    ok: true,
    join,
    sources,
    formulation: {
      slug: otcSlug(label.set_id),
      brandName,
      genericName: sentenceCase(generic),
      dosageForm,
      isFictional: false,
      ndcPackages,
      activeIngredients: ingredients,
      directionsText,
      max24hText: balanceParens(parseMax24h(directionsText), directionsText),
      warningsQuotes: parseWarningsQuotes(label, ingredients),
      dosageTableHtml,
      source: "openfda",
      openfdaSetId: label.set_id,
      labelEffectiveDate: date ? `${date[1]}-${date[2]}-${date[3]}` : null,
      labelerName: (products[0]?.labeler_name ?? o.manufacturer_name?.[0] ?? "").trim() || null,
      labelSections: labelSections(label, { spl: options.spl ?? null, ingredientNames: ingredients.map((i) => i.name) }),
      sourceLinks: [{ label: "FDA label (DailyMed)", url: dailyMedUrl(label.set_id) }],
    },
  };
}

/** Whole-run gate: every stored strength is the label's printed amount for that ingredient. */
export function rowIsTraceable(f: CatalogFormulation, label: FdaLabel): boolean {
  const text = activeIngredientText(label);
  return f.activeIngredients.every((i) =>
    strengthIsTraceable(
      i,
      f.activeIngredients.filter((x) => x !== i).map((x) => x.name),
      text,
    ),
  );
}

export type ImportResult = {
  rows: CatalogFormulation[];
  rejects: Partial<Record<RejectReason, number>>;
  /** Up to 5 "brand (set id)" per reject reason, for the report. */
  rejectExamples: Partial<Record<RejectReason, string[]>>;
  joins: Record<JoinMethod, number>;
  /** How each stored strength was settled, over all rows. */
  strengthSources: Record<StrengthSource, number>;
  /** Rows that passed the whole-run traceability gate (all of `rows`). */
  traceableRows: number;
  /** Mapped, then skipped because a package NDC is on a hand-checked row. */
  skippedForReviewed: CatalogFormulation[];
  /** set_id → "row" or the reject reason. */
  status: Map<string, "row" | RejectReason>;
};

export type ImportOptions = { spl?: Map<string, SplSections> };

/** Map every label; labels sharing a package NDC with a reviewed row are skipped (reviewed rows win). */
export function importLabels(labels: FdaLabel[], index: NdcIndex, reviewedNdcs: Set<string>, options: ImportOptions = {}): ImportResult {
  const result: ImportResult = {
    rows: [],
    rejects: {},
    rejectExamples: {},
    joins: { spl_id: 0, package_ndc: 0, none: 0 },
    strengthSources: { label_and_ndc: 0, label: 0, ndc_per: 0 },
    traceableRows: 0,
    skippedForReviewed: [],
    status: new Map(),
  };
  const count = (reason: RejectReason, label: FdaLabel) => {
    if (label.set_id) result.status.set(label.set_id, reason);
    result.rejects[reason] = (result.rejects[reason] ?? 0) + 1;
    const examples = (result.rejectExamples[reason] ??= []);
    if (examples.length < 5) examples.push(`${label.openfda?.brand_name?.[0] ?? "?"} (${label.set_id})`);
  };
  const seen = new Set<string>();
  for (const label of labels) {
    if (label.set_id && seen.has(label.set_id)) continue;
    if (label.set_id) seen.add(label.set_id);
    const mapped = mapLabel(label, index, { spl: label.set_id ? options.spl?.get(label.set_id) : null });
    result.joins[mapped.join]++;
    if (!mapped.ok) {
      count(mapped.reason, label);
      continue;
    }
    if (!rowIsTraceable(mapped.formulation, label)) {
      count("untraceable_strength", label);
      continue;
    }
    result.traceableRows++;
    if (mapped.formulation.ndcPackages.some((n) => reviewedNdcs.has(n))) {
      count("reviewed_ndc", label);
      result.skippedForReviewed.push(mapped.formulation);
      continue;
    }
    for (const s of mapped.sources) result.strengthSources[s]++;
    result.status.set(label.set_id!, "row");
    result.rows.push(mapped.formulation);
  }
  return result;
}
