// Compare with my medicines (spec: 2026-10-18-compare-with-my-medicines-design.md): what the picker,
// the check-before-comparing summary and the results show. Pure; client-safe. Nothing is decided here:
// the findings are runChecks()'s, unchanged. This lists the medicines, orders the runs, names them
// neutrally and lays the medicines side by side; strengths are shown as printed, never added up.
import { CHECK_TITLES } from "@/lib/checks";
import { mgPerMl, sourceLabel } from "@/lib/checks/shared";
import type { ComparedProduct } from "@/lib/compare";
import { confirmedFieldsFromFormulation, entryLabel, formatStrength, isUsable } from "@/lib/domain/fields";
import { normalizeIngredient } from "@/lib/domain/ingredients";
import type { CheckId, CheckRun, Finding, Formulation, MedicationEntry } from "@/lib/domain/schema";
import { formatDocDate } from "@/lib/record-format";

/** The card's medicine: a saved entry, or a photo's draft matched to `formulationId` (not saved). */
export type CompareSubject = { entryId: string; formulationId?: string };

export type ValueState = "confirmed" | "needs_confirmation";
export type MedicineStatus = "confirmed" | "needs_confirmation" | "waiting_for_review";

export type MedicineSummary = {
  id: string;
  name: string;
  ingredients: { name: string; strength: string | null; state: ValueState }[];
  form: string | null;
  formState: ValueState;
  status: MedicineStatus;
  fictional: boolean;
};

export type ComparedCard = MedicineSummary & { letter: string; source: string; date: string | null };
/** One bottle's bar: its strength as printed, and its length on a shared scale (0–1]. */
export type ConcentrationBar = { entryId: string; name: string; strength: string; ratio: number };
export type FindingView = { finding: Finding; label: string; bars: ConcentrationBar[] | null };
export type ComparisonView = {
  cards: ComparedCard[];
  products: ComparedProduct[];
  findings: FindingView[];
  unresolved: { check: CheckId; title: string; reasons: string[] }[];
  checksRun: { check: CheckId; title: string; line: string }[];
};

/** Neutral names for what a finding is; the finding's own title says which medicines. */
export const FINDING_LABELS: Partial<Record<CheckId, string>> = {
  ingredient_overlap: "Shared ingredient identified",
  ingredient_family: "Same family of medicine",
  repeated_record: "Same medicine listed twice",
  concentration: "Different concentrations",
  units: "Different units or measurement basis",
  database_vs_box: "Listing and package differ",
};
export const NONE_FOUND = "None found in confirmed fields";
export const NOTHING_TO_COMPARE = "Nothing to compare";
export const NOT_SAFE_LINE = "“None found” only means none in the confirmed fields. It doesn't mean safe.";
export const CONCENTRATION_SENTENCE = "These bottles contain different amounts of the active ingredient in the same liquid volume.";

const stateOf = (ok: boolean): ValueState => (ok ? "confirmed" : "needs_confirmation");

/** What the picker and the review show for a medicine: its values and whether each is confirmed. */
export function summarize(entry: MedicationEntry, formulation?: Formulation | null): MedicineSummary {
  const f = entry.fields;
  const ingredients = f.ingredients.map((i) => {
    const strength = i.strength.value ?? i.strength.aiValue;
    return {
      name: i.name.value ?? i.name.aiValue ?? "Unnamed ingredient",
      strength: strength ? formatStrength(strength) : null,
      state: stateOf(isUsable(i.name) && isUsable(i.strength)),
    };
  });
  const formState = stateOf(isUsable(f.dosageForm));
  const complete = ingredients.length > 0 && ingredients.every((i) => i.state === "confirmed") && formState === "confirmed";
  return {
    id: entry.id,
    name: entryLabel(f),
    ingredients,
    form: f.dosageForm.value ?? f.dosageForm.aiValue,
    formState,
    status: entry.status === "draft" ? "waiting_for_review" : complete ? "confirmed" : "needs_confirmation",
    fictional: formulation?.isFictional ?? false,
  };
}

const STATUS_ORDER: Record<MedicineStatus, number> = { confirmed: 0, needs_confirmation: 1, waiting_for_review: 2 };

/** The person's other medicines to pick from: not the subject, nor the other unsaved medicines of its photo. */
export function pickOptions(entries: MedicationEntry[], subject: MedicationEntry, formulations: Record<string, Formulation>): MedicineSummary[] {
  const photo = subject.sourceDocument?.id ?? null;
  return entries
    .filter((e) => e.id !== subject.id && !(photo && e.status === "draft" && e.sourceDocument?.id === photo))
    .map((e) => summarize(e, e.formulationId ? formulations[e.formulationId] : null))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

/** A photo's draft, matched to its FDA label by the user's tap, compares as that label's confirmed values. Never saved. */
export function subjectEntry(entry: MedicationEntry, formulation: Formulation | null): MedicationEntry {
  if (entry.status !== "draft" || !formulation) return entry;
  return { ...entry, status: "confirmed", formulationId: formulation.id, fields: confirmedFieldsFromFormulation(formulation) };
}

const STRENGTH_FIELD = /^ingredients\[(\d+)\]\.strength$/;

/** For a different-concentrations finding: each bottle's printed strength, scaled by mg per mL (never shown). */
export function concentrationBars(finding: Finding, entries: ReadonlyMap<string, MedicationEntry>): ConcentrationBar[] | null {
  if (finding.check !== "concentration") return null;
  const rows = finding.evidence.flatMap((e) => {
    const index = STRENGTH_FIELD.exec(e.field)?.[1];
    const field = index === undefined ? undefined : entries.get(e.entryId)?.fields.ingredients[Number(index)]?.strength;
    if (!field || !isUsable(field)) return [];
    const perMl = mgPerMl(field.value);
    return perMl === null ? [] : [{ entryId: e.entryId, name: e.entryLabel, strength: formatStrength(field.value), perMl }];
  });
  if (rows.length < 2) return null;
  const max = Math.max(...rows.map((r) => r.perMl));
  return rows.map(({ perMl, ...bar }) => ({ ...bar, ratio: perMl / max }));
}

function cardSource(entry: MedicationEntry, formulation: Formulation | null): { source: string; date: string | null } {
  if (formulation) return { source: formulation.isFictional ? "Fictional demo label" : "FDA label", date: formatDocDate(formulation.labelEffectiveDate) };
  return { source: sourceLabel(entry), date: formatDocDate(entry.sourceDocument?.documentDate ?? null) };
}

/** Together compares each picked medicine as its own column: its FDA label, else its confirmed fields. */
function comparedProduct(entry: MedicationEntry, formulation: Formulation | null): ComparedProduct {
  if (formulation) {
    const { brandName, activeIngredients, labelSections, warningsQuotes } = formulation;
    return { id: entry.id, brandName, activeIngredients, labelSections, warningsQuotes };
  }
  return {
    id: entry.id,
    brandName: entryLabel(entry.fields),
    activeIngredients: entry.fields.ingredients.flatMap((i) =>
      isUsable(i.name) && isUsable(i.strength) ? [{ name: i.name.value, normalized: normalizeIngredient(i.name.value), strength: i.strength.value }] : [],
    ),
    labelSections: {},
    warningsQuotes: [],
  };
}

const letter = (i: number) => String.fromCharCode(65 + i);
const titleOf = (check: CheckId) => CHECK_TITLES[check] ?? check;

/** The results: `entries` are the subject first, then the picks, in pick order. */
export function comparisonView({
  entries,
  formulations,
  runs,
}: {
  entries: MedicationEntry[];
  formulations: Record<string, Formulation>;
  runs: CheckRun[];
}): ComparisonView {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const labelOf = (e: MedicationEntry) => (e.formulationId ? (formulations[e.formulationId] ?? null) : null);
  const seen = new Set<string>();
  return {
    cards: entries.map((e, i) => ({ ...summarize(e, labelOf(e)), letter: letter(i), ...cardSource(e, labelOf(e)) })),
    products: entries.map((e) => comparedProduct(e, labelOf(e))),
    findings: runs
      .flatMap((r) => r.findings)
      .filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)))
      .map((finding) => ({ finding, label: FINDING_LABELS[finding.check] ?? titleOf(finding.check), bars: concentrationBars(finding, byId) })),
    unresolved: runs
      .filter((r) => r.reasons.length > 0 && (r.status === "unresolved" || r.status === "finding"))
      .map((r) => ({ check: r.check, title: titleOf(r.check), reasons: r.reasons })),
    checksRun: runs
      .filter((r) => r.status === "no_finding" || r.status === "not_applicable")
      .map((r) => ({ check: r.check, title: titleOf(r.check), line: r.status === "no_finding" ? NONE_FOUND : NOTHING_TO_COMPARE })),
  };
}
