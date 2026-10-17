// Helpers shared by the six checks. Pure. Values only count when `isUsable` (confirmed or edited).
import { entryLabel, isUsable } from "@/lib/domain/fields";
import { normalizeIngredient } from "@/lib/domain/ingredients";
import type {
  CheckId,
  CheckRun,
  DoseAsWritten,
  Evidence,
  Field,
  Finding,
  FindingEvidence,
  MedicationEntry,
  SourceDocumentKind,
  Strength,
} from "@/lib/domain/schema";

// ---------------------------------------------------------------------------
// Names and sources
// ---------------------------------------------------------------------------

export const DOCUMENT_KIND_LABEL: Record<SourceDocumentKind, string> = {
  otc_package: "Package label",
  drug_facts_photo: "Drug Facts photo",
  prescription_label: "Prescription label",
  discharge_list: "Discharge list",
  description: "Your description",
};

/** Where an entry's values came from, capitalized: "Prescription label", "Database label", … */
export function sourceLabel(entry: MedicationEntry): string {
  if (entry.sourceDocument) return DOCUMENT_KIND_LABEL[entry.sourceDocument.kind];
  if (entry.inputMethod === "barcode" || entry.inputMethod === "picker") return "Database label";
  if (entry.inputMethod === "voice" || entry.inputMethod === "typed") return "Your description";
  return "Medicine record";
}

/** The source as a pharmacist question would say it: "the discharge list", "the bottle", … */
export function sourcePhrase(entry: MedicationEntry): string {
  switch (documentClass(entry)) {
    case "prescription_label":
      return "the prescription label";
    case "discharge_list":
      return "the discharge list";
    case "bottle":
      return "the bottle";
    default:
      return "my description";
  }
}

export type DocumentClass = "bottle" | "prescription_label" | "discharge_list";

/** Package, Drug Facts photo and catalog (barcode/picker) entries are all "the bottle". Descriptions are no document. */
export function documentClass(entry: MedicationEntry): DocumentClass | null {
  switch (entry.sourceDocument?.kind) {
    case "otc_package":
    case "drug_facts_photo":
      return "bottle";
    case "prescription_label":
      return "prescription_label";
    case "discharge_list":
      return "discharge_list";
    case "description":
      return null;
  }
  return entry.inputMethod === "voice" || entry.inputMethod === "typed" ? null : "bottle";
}

export function labelOf(entry: MedicationEntry): string {
  return entryLabel(entry.fields);
}

/** "Strength unreadable on Prescription label (Acetaminophen oral suspension)". */
export function unusableReason(entry: MedicationEntry, fieldName: string, field: Field<unknown>): string {
  const what = field.state === "pending" ? "not confirmed yet" : "unreadable";
  return `${fieldName} ${what} on ${sourceLabel(entry)} (${labelOf(entry)})`;
}

export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Acetaminophen 325 mg" → "Acetaminophen", so a strength isn't printed twice. */
export function displayIngredientName(name: string): string {
  return name.replace(/\s*\d+(\.\d+)?\s*(mg|mcg|g)\b.*$/i, "").trim() || name;
}

// ---------------------------------------------------------------------------
// Ingredients
// ---------------------------------------------------------------------------

export type UsableIngredient = {
  index: number;
  name: string; // as confirmed
  normalized: string;
  strengthField: Field<Strength>;
  strength: Strength | null; // only when usable
};

/** Ingredients whose name the user confirmed. */
export function usableIngredients(entry: MedicationEntry): UsableIngredient[] {
  return entry.fields.ingredients.flatMap((ing, index) => {
    if (!isUsable(ing.name)) return [];
    return [
      {
        index,
        name: ing.name.value,
        normalized: normalizeIngredient(ing.name.value),
        strengthField: ing.strength,
        strength: isUsable(ing.strength) ? ing.strength.value : null,
      },
    ];
  });
}

/** Why this entry's active ingredients can't be compared, or null when they can. */
export function ingredientProblem(entry: MedicationEntry): string | null {
  if (entry.fields.ingredients.length === 0) {
    return `Active ingredient not recorded on ${sourceLabel(entry)} (${labelOf(entry)})`;
  }
  const bad = entry.fields.ingredients.find((i) => !isUsable(i.name));
  return bad ? unusableReason(entry, "Active ingredient", bad.name) : null;
}

// ---------------------------------------------------------------------------
// Strengths and forms. Arithmetic here is internal, for comparison only — never displayed.
// ---------------------------------------------------------------------------

const MG_PER: Record<string, number> = { mg: 1, mcg: 0.001, g: 1000 };
const ML_PER: Record<string, number> = { ml: 1, milliliter: 1, milliliters: 1, l: 1000 };
const VOLUME_UNITS = new Set(["ml", "milliliter", "milliliters", "l", "cc", "tsp", "teaspoon", "teaspoons", "tbsp", "tablespoon", "tablespoons"]);
const MASS_UNITS = new Set(["mg", "mcg", "g", "gram", "grams", "milligram", "milligrams"]);

const unitKey = (u: string) => u.trim().toLowerCase().replace(/\.$/, "");

export const isVolumeUnit = (u: string | null): boolean => !!u && VOLUME_UNITS.has(unitKey(u));
export const isMassUnit = (u: string | null): boolean => !!u && MASS_UNITS.has(unitKey(u));
export const isSpoonUnit = (u: string | null): boolean =>
  !!u && ["tsp", "teaspoon", "teaspoons", "tbsp", "tablespoon", "tablespoons"].includes(unitKey(u));

/** mg per mL, for comparing liquids. Null when the strength isn't a mass per mL/L. */
export function mgPerMl(s: Strength): number | null {
  const mg = MG_PER[s.unit];
  const perUnit = s.perUnit ? ML_PER[unitKey(s.perUnit)] : undefined;
  if (mg === undefined || perUnit === undefined) return null;
  return (s.amount * mg) / ((s.perAmount ?? 1) * perUnit);
}

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** A comparable key for a strength: mg per mL for liquids, else mg per normalized unit. */
export function strengthKey(s: Strength): string {
  const perMl = mgPerMl(s);
  if (perMl !== null) return `mg/ml:${Number(perMl.toPrecision(9))}`;
  const mg = MG_PER[s.unit];
  const amount = mg === undefined ? `${s.amount}${s.unit}` : `${Number((s.amount * mg).toPrecision(9))}mg`;
  const per = s.perUnit ? unitKey(s.perUnit).replace(/s$/, "") : "";
  return `${amount}/${s.perAmount ?? 1}${per}`;
}

export function strengthsMatch(a: Strength, b: Strength): boolean {
  const x = mgPerMl(a);
  const y = mgPerMl(b);
  if (x !== null && y !== null) return close(x, y);
  return strengthKey(a) === strengthKey(b);
}

const LIQUID_FORM = /liquid|suspension|solution|syrup|elixir|drops|oral\s*liquid/i;
const SOLID_FORM = /tablet|caplet|capsule|softgel|liqui-?cap|gelcap|chewable|lozenge|powder|packet|gumm|suppositor/i;

/** "liquid" or "solid", from the confirmed form, else from a confirmed strength; null when unknown. */
export function formFamily(entry: MedicationEntry): "liquid" | "solid" | null {
  const form = entry.fields.dosageForm;
  if (isUsable(form)) {
    if (SOLID_FORM.test(form.value)) return "solid";
    if (LIQUID_FORM.test(form.value)) return "liquid";
  }
  for (const ing of entry.fields.ingredients) {
    if (!isUsable(ing.strength)) continue;
    if (isVolumeUnit(ing.strength.value.perUnit)) return "liquid";
    if (ing.strength.value.perUnit) return "solid";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Dose as written
// ---------------------------------------------------------------------------

export type DoseStatus =
  | { kind: "usable"; dose: DoseAsWritten; field: Field<DoseAsWritten> }
  | { kind: "absent" }
  | { kind: "unresolved"; reason: string };

/**
 * A dose the checks may use. A field that was never suggested (no value, no evidence — e.g. a catalog
 * label with its dose in a table) counts as "no dose written"; anything suggested but not confirmed
 * is unresolved.
 */
export function doseStatus(entry: MedicationEntry): DoseStatus {
  const f = entry.fields.doseAsWritten;
  if (isUsable(f)) return { kind: "usable", dose: f.value, field: f };
  if (f.state === "unknown" && f.aiValue === null && f.evidence.kind === "none") return { kind: "absent" };
  return { kind: "unresolved", reason: unusableReason(entry, "Dose", f) };
}

// ---------------------------------------------------------------------------
// Findings and runs
// ---------------------------------------------------------------------------

export function evidenceItem(
  entry: MedicationEntry,
  field: string,
  text: string,
  evidence: Evidence,
): FindingEvidence {
  return {
    entryId: entry.id,
    entryLabel: labelOf(entry),
    field,
    text,
    evidence,
    documentKind: entry.sourceDocument?.kind ?? null,
    documentDate: entry.sourceDocument?.documentDate ?? null,
  };
}

/** Deterministic: `${check}:${sorted entry ids}:${discriminator}`. */
export function findingId(check: CheckId, entryIds: string[], discriminator: string): string {
  return `${check}:${sortedIds(entryIds).join(",")}:${discriminator}`;
}

export function sortedIds(ids: string[]): string[] {
  return [...new Set(ids)].sort();
}

export function makeFinding(f: Omit<Finding, "id" | "entryIds"> & { entryIds: string[]; discriminator: string }): Finding {
  const { discriminator, ...rest } = f;
  return { ...rest, id: findingId(f.check, f.entryIds, discriminator), entryIds: sortedIds(f.entryIds) };
}

/**
 * finding (any findings; reasons for skipped entries still listed) → unresolved (any reasons)
 * → no_finding (something was compared) → not_applicable.
 */
export function buildRun(
  check: CheckId,
  opts: {
    findings: Finding[];
    reasons: string[];
    compared: boolean;
    found: (n: number) => string;
    noFinding: string; // "No … found in confirmed fields"
    notApplicable: string;
  },
): CheckRun {
  const reasons = [...new Set(opts.reasons)];
  if (opts.findings.length > 0) {
    return { check, status: "finding", summary: opts.found(opts.findings.length), reasons, findings: opts.findings };
  }
  if (reasons.length > 0) {
    const more = reasons.length > 1 ? ` (and ${reasons.length - 1} more)` : "";
    return {
      check,
      status: "unresolved",
      summary: `Couldn't be completed: ${lowerFirst(reasons[0])}${more}`,
      reasons,
      findings: [],
    };
  }
  if (opts.compared) return { check, status: "no_finding", summary: opts.noFinding, reasons: [], findings: [] };
  return { check, status: "not_applicable", summary: "Nothing to compare", reasons: [opts.notApplicable], findings: [] };
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
