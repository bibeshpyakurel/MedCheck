# Compare With My Medicines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From any medicine card, the user picks saved medicines for the same person and sees them side by side: **Together**, the label-backed findings with a copyable pharmacist question, concentration bars, "Unable to complete" reasons, and the checks that found nothing. Nothing is saved.

**Architecture:** No new comparison engine. A server action runs the existing `runChecks()` over the subject plus the picked entries and returns the entries, formulations and runs. A pure view model, `comparisonView()` in `src/lib/compare-view.ts`, orders and names them, lays out the side-by-side cards, adapts entries for `IngredientComparison`, and computes the bar ratios. The UI reuses `WarningCard` (the same component the Medicines page uses), `IngredientComparison`, `MedicineCardSheet` and `useBackToClose`.

**Tech Stack:** Next.js 16 server actions, React 19, Base UI Dialog (shadcn `base-nova`), zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-18-compare-with-my-medicines-design.md`

## Global Constraints

- Never "safe", "no risk" or green. `no_finding` reads "None found in confirmed fields". The fixed line "“None found” only means none in the confirmed fields. It doesn't mean safe." is the only place the word appears, as a negation the spec requires.
- No replacement volume, no dose, no advice on which product to use. Nothing claims the user took both. Pharmacist questions are the existing `checks/questions.ts` templates, unchanged.
- Strengths are shown as printed, side by side, never summed. The concentration bars are scaled by the check's internal mg per mL, which is never displayed.
- Compare saves nothing. A photo's draft compares as its matched label's confirmed values only in memory.
- Only the user's own person's entries (RLS, plus `patientId` checks in the action).
- No schema change, no new `CheckId`, no export change.
- Overlays use `useBackToClose`; a link inside calls `release()` and navigates with `replace`.
- Phone-first, tap targets ≥ 44 px, light and dark tokens.
- Before pushing: `npm run lint && npm run typecheck && npm test && npm run build`.

## File map

| File | Responsibility |
|---|---|
| `src/lib/compare-view.ts` (create) | `summarize`, `pickOptions`, `subjectEntry`, `concentrationBars`, `comparisonView`, labels and fixed lines |
| `src/lib/compare-view.test.ts` (create) | the rules over the check fixtures |
| `src/app/patients/[patientId]/compare-actions.ts` (create) | `compareChoicesAction`, `compareMedicinesAction` |
| `src/components/checks/warning-card.tsx` (modify) | optional `label` eyebrow and `children` slot |
| `src/components/medicine-card/medicine-card-sheet.tsx` (modify) | pass `actions`, `defaultTab` through |
| `src/components/compare/compare-button.tsx` (create, client) | loads choices; the button; opens the sheet |
| `src/components/compare/compare-sheet.tsx` (create, client) | the dialog: pick and review, then results |
| `src/components/compare/compare-results.tsx` (create, client) | cards, Together, findings, unresolved, checks run |
| `src/components/compare/compared-cards.tsx`, `concentration-bars.tsx`, `copy-question.tsx`, `label-sheet-button.tsx` (create) | result pieces |
| `src/components/medicine-card/medicine-card-button.tsx`, `src/components/photo-answers/answer-result.tsx`, `photo-answers-dialog.tsx`, the entry page (modify) | wire the button |
| `e2e/medcheck.spec.ts` (modify) | one compare flow |
| `AGENTS.md` (modify) | code map + spec list |

---

### Task 1: `compare-view.ts`

**Files:** Create `src/lib/compare-view.ts`, `src/lib/compare-view.test.ts`

**Interfaces:**
- Consumes: `CHECK_TITLES`, `runChecks` (`@/lib/checks`); `mgPerMl`, `sourceLabel` (`@/lib/checks/shared`); `confirmedFieldsFromFormulation`, `entryLabel`, `formatStrength`, `isUsable` (`@/lib/domain/fields`); `normalizeIngredient`; `ComparedProduct` (`@/lib/compare`); `formatDocDate` (`@/lib/record-format`).
- Produces:
  ```ts
  export type CompareSubject = { entryId: string; formulationId?: string };
  export type ValueState = "confirmed" | "needs_confirmation";
  export type MedicineStatus = "confirmed" | "needs_confirmation" | "waiting_for_review";
  export type MedicineSummary = { id: string; name: string; ingredients: { name: string; strength: string | null; state: ValueState }[]; form: string | null; formState: ValueState; status: MedicineStatus; fictional: boolean };
  export type ComparedCard = MedicineSummary & { letter: string; source: string; date: string | null };
  export type ConcentrationBar = { entryId: string; name: string; strength: string; ratio: number };
  export type FindingView = { finding: Finding; label: string; bars: ConcentrationBar[] | null };
  export type ComparisonView = { cards: ComparedCard[]; products: ComparedProduct[]; findings: FindingView[]; unresolved: { check: CheckId; title: string; reasons: string[] }[]; checksRun: { check: CheckId; title: string; line: string }[] };
  export function summarize(entry: MedicationEntry, formulation?: Formulation | null): MedicineSummary;
  export function pickOptions(entries: MedicationEntry[], subject: MedicationEntry, formulations: Record<string, Formulation>): MedicineSummary[];
  export function subjectEntry(entry: MedicationEntry, formulation: Formulation | null): MedicationEntry;
  export function concentrationBars(finding: Finding, entries: ReadonlyMap<string, MedicationEntry>): ConcentrationBar[] | null;
  export function comparisonView(input: { entries: MedicationEntry[]; formulations: Record<string, Formulation>; runs: CheckRun[] }): ComparisonView;
  export const FINDING_LABELS, NONE_FOUND, NOTHING_TO_COMPARE, NOT_SAFE_LINE, CONCENTRATION_SENTENCE;
  ```

- [ ] **Step 1: Write the failing tests** (`src/lib/compare-view.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { advil, aleve, FAMILY_FORMULATIONS } from "@/lib/__fixtures__/family-formulations";
import { runChecks } from "@/lib/checks";
import {
  CALMORA_A_ID,
  calmoraA,
  calmoraAAgain,
  calmoraAFormulation,
  calmoraB,
  FORMULATIONS,
  makeEntry,
  pending,
  prescription,
  prescriptionStrengthPending,
} from "@/lib/checks/__fixtures__/entries";
import type { Formulation, MedicationEntry } from "@/lib/domain/schema";
import {
  CONCENTRATION_SENTENCE,
  comparisonView,
  FINDING_LABELS,
  NONE_FOUND,
  NOT_SAFE_LINE,
  NOTHING_TO_COMPARE,
  pickOptions,
  subjectEntry,
  summarize,
} from "./compare-view";

const ALL_FORMULATIONS: Record<string, Formulation> = { ...FORMULATIONS, ...FAMILY_FORMULATIONS };

const view = (...entries: MedicationEntry[]) =>
  comparisonView({ entries, formulations: ALL_FORMULATIONS, runs: runChecks({ entries, formulations: ALL_FORMULATIONS }) });

const fromLabel = (f: Formulation, id: string) =>
  makeEntry({
    id,
    name: f.brandName,
    form: f.dosageForm,
    ingredients: f.activeIngredients.map((i) => ({ name: i.name, strength: i.strength })),
    formulationId: f.id,
    doc: { kind: "otc_package" },
    evidence: { kind: "database", formulationId: f.id },
  });

describe("summarize", () => {
  it("a confirmed catalog medicine: name, ingredient with strength, form, fictional", () => {
    expect(summarize(calmoraA, calmoraAFormulation)).toEqual({
      id: "e-calmora-a",
      name: "Calmora Fever Relief (Bottle A)",
      ingredients: [{ name: "Acetaminophen", strength: "100 mg per 5 mL", state: "confirmed" }],
      form: "liquid",
      formState: "confirmed",
      status: "confirmed",
      fictional: true,
    });
  });

  it("a confirmed entry with a pending strength needs confirmation", () => {
    const s = summarize(prescriptionStrengthPending);
    expect(s.status).toBe("needs_confirmation");
    expect(s.ingredients[0]).toEqual({ name: "Acetaminophen", strength: "160 mg per 5 mL", state: "needs_confirmation" });
  });

  it("a draft is waiting for review", () => {
    expect(summarize({ ...calmoraB, status: "draft" }).status).toBe("waiting_for_review");
  });
});

describe("pickOptions", () => {
  it("leaves out the subject and the other drafts of its photo; confirmed first, drafts last", () => {
    const draftSibling = { ...calmoraB, id: "e-sibling", status: "draft" as const, sourceDocument: calmoraA.sourceDocument };
    const otherDraft = { ...prescription, id: "e-other-draft", status: "draft" as const };
    const options = pickOptions([otherDraft, calmoraA, draftSibling, prescriptionStrengthPending, calmoraB], calmoraA, ALL_FORMULATIONS);
    expect(options.map((o) => o.id)).toEqual(["e-calmora-b", "e-rx-pending", "e-other-draft"]);
  });
});

describe("subjectEntry", () => {
  it("a photo's draft compares as its matched label's confirmed values", () => {
    const draft = makeEntry({ id: "e-photo", name: pending("Calmora", { kind: "none" }), form: null, ingredients: [], status: "draft", doc: { kind: "otc_package" } });
    const s = subjectEntry(draft, calmoraAFormulation);
    expect(s.status).toBe("confirmed");
    expect(s.formulationId).toBe(CALMORA_A_ID);
    expect(s.fields.ingredients[0].strength.state).toBe("confirmed");
    expect(s.id).toBe("e-photo");
  });

  it("a saved entry is used as it is", () => {
    expect(subjectEntry(calmoraA, calmoraAFormulation)).toBe(calmoraA);
  });
});

describe("comparisonView", () => {
  it("Calmora A and B: shared ingredient and different concentrations, with bars on one scale", () => {
    const v = view(calmoraA, calmoraB);
    expect(v.findings.map((f) => f.label)).toEqual([FINDING_LABELS.ingredient_overlap, FINDING_LABELS.concentration]);
    const bars = v.findings.find((f) => f.finding.check === "concentration")?.bars;
    expect(bars).toEqual([
      { entryId: "e-calmora-a", name: "Calmora Fever Relief (Bottle A)", strength: "100 mg per 5 mL", ratio: 0.5 },
      { entryId: "e-calmora-b", name: "Calmora Extra Fever Relief (Bottle B)", strength: "200 mg per 5 mL", ratio: 1 },
    ]);
    expect(v.findings[0].bars).toBeNull();
  });

  it("cards: letters in pick order, source and date, strengths as printed", () => {
    const v = view(calmoraA, calmoraB);
    expect(v.cards.map((c) => [c.letter, c.name, c.source, c.ingredients[0].strength])).toEqual([
      ["A", "Calmora Fever Relief (Bottle A)", "Fictional demo label", "100 mg per 5 mL"],
      ["B", "Calmora Extra Fever Relief (Bottle B)", "Package label", "200 mg per 5 mL"],
    ]);
  });

  it("Together compares each picked medicine as its own column, label or confirmed fields", () => {
    const v = view(calmoraA, calmoraB);
    expect(v.products.map((p) => [p.id, p.brandName, p.activeIngredients.map((i) => i.normalized)])).toEqual([
      ["e-calmora-a", "Calmora Fever Relief (Bottle A)", ["acetaminophen"]],
      ["e-calmora-b", "Calmora Extra Fever Relief (Bottle B)", ["acetaminophen"]],
    ]);
  });

  it("the same product twice is the same medicine listed twice", () => {
    expect(view(calmoraA, calmoraAAgain).findings.map((f) => f.finding.check)).toContain("repeated_record");
  });

  it("two NSAIDs are the same family", () => {
    expect(view(fromLabel(advil, "e-advil"), fromLabel(aleve, "e-aleve")).findings.map((f) => f.label)).toContain(FINDING_LABELS.ingredient_family);
  });

  it("a pending strength makes the concentration comparison unable to complete", () => {
    const v = view(calmoraA, prescriptionStrengthPending);
    const concentration = v.unresolved.find((u) => u.check === "concentration");
    expect(concentration?.reasons.join(" ")).toMatch(/not confirmed yet/);
  });

  it("checks with nothing found say so neutrally", () => {
    const v = view(calmoraA, calmoraB);
    expect(v.checksRun.length).toBeGreaterThan(0);
    for (const c of v.checksRun) expect([NONE_FOUND, NOTHING_TO_COMPARE]).toContain(c.line);
  });

  it("our words never say safe, except the fixed line that says None found isn't safe", () => {
    const v = view(calmoraA, calmoraB, prescriptionStrengthPending);
    const ours = [...Object.values(FINDING_LABELS), NONE_FOUND, NOTHING_TO_COMPARE, CONCENTRATION_SENTENCE, ...v.cards.map((c) => c.source), ...v.checksRun.map((c) => c.title)];
    for (const s of ours) expect(s).not.toMatch(/\bsafe\b/i);
    expect(NOT_SAFE_LINE).toBe("“None found” only means none in the confirmed fields. It doesn't mean safe.");
  });
});
```

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/lib/compare-view.test.ts` (module missing).

- [ ] **Step 3: Implement** (`src/lib/compare-view.ts`)

```ts
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
export function comparisonView({ entries, formulations, runs }: { entries: MedicationEntry[]; formulations: Record<string, Formulation>; runs: CheckRun[] }): ComparisonView {
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
```

- [ ] **Step 4: Run, expect PASS** — `npx vitest run src/lib/compare-view.test.ts`. If a fixture expectation is off (e.g. the second card's `source`), check the fixture first; fix the code only when the rule is wrong.
- [ ] **Step 5: Commit** — `feat(compare): comparisonView(): pick list, review summary and results from runChecks()`

---

### Task 2: Server actions

**Files:** Create `src/app/patients/[patientId]/compare-actions.ts`

**Interfaces:**
- Consumes: `requireUser`; `getEntry`, `listEntries`; `getFormulation`, `getFormulationsByIds`; `runChecks`; `pickOptions`, `subjectEntry`, `summarize`, `CompareSubject`, `MedicineSummary` (Task 1).
- Produces:
  ```ts
  export type CompareError = { error: string };
  export type CompareChoices = { subject: MedicineSummary; options: MedicineSummary[] };
  export type CompareResult = { entries: MedicationEntry[]; formulations: Record<string, Formulation>; runs: CheckRun[] };
  export async function compareChoicesAction(input: { patientId: string; subject: CompareSubject }): Promise<CompareChoices | CompareError>;
  export async function compareMedicinesAction(input: { patientId: string; subject: CompareSubject; entryIds: string[] }): Promise<CompareResult | CompareError>;
  ```

- [ ] **Step 1: Implement**

```ts
"use server";

// Compare with my medicines (spec: compare-with-my-medicines §3): the medicines to pick from, then the
// existing checks over the card's medicine and the picks. Saves nothing. Only this person's own entries
// (RLS, plus the patientId checks here); a photo's draft compares as its matched label (subjectEntry).
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getFormulation, getFormulationsByIds } from "@/lib/catalog";
import { runChecks } from "@/lib/checks";
import { type CompareSubject, type MedicineSummary, pickOptions, subjectEntry, summarize } from "@/lib/compare-view";
import type { CheckRun, Formulation, MedicationEntry } from "@/lib/domain/schema";
import { getEntry, listEntries } from "@/lib/records";

export type CompareError = { error: string };
export type CompareChoices = { subject: MedicineSummary; options: MedicineSummary[] };
export type CompareResult = { entries: MedicationEntry[]; formulations: Record<string, Formulation>; runs: CheckRun[] };

const NOT_FOUND: CompareError = { error: "This medicine isn't on file for this person any more." };
const subjectSchema = z.object({ entryId: z.guid(), formulationId: z.guid().optional() });
const choicesSchema = z.object({ patientId: z.guid(), subject: subjectSchema });
const compareSchema = choicesSchema.extend({ entryIds: z.array(z.guid()).min(1).max(20) });

/** The card's medicine as the checks see it, with the person's entries; null when it isn't this person's. */
async function load(patientId: string, subject: CompareSubject) {
  await requireUser();
  const [entry, entries] = await Promise.all([getEntry(subject.entryId), listEntries(patientId)]);
  if (!entry || entry.patientId !== patientId) return null;
  const label = subject.formulationId ? await getFormulation(subject.formulationId) : null;
  if (subject.formulationId && !label) return null;
  return { subject: subjectEntry(entry, label), entries };
}

export async function compareChoicesAction(input: { patientId: string; subject: CompareSubject }): Promise<CompareChoices | CompareError> {
  const parsed = choicesSchema.safeParse(input);
  if (!parsed.success) return NOT_FOUND;
  const loaded = await load(parsed.data.patientId, parsed.data.subject);
  if (!loaded) return NOT_FOUND;
  const formulations = await getFormulationsByIds(
    [...new Set([loaded.subject, ...loaded.entries].flatMap((e) => (e.formulationId ? [e.formulationId] : [])))],
  );
  const subjectLabel = loaded.subject.formulationId ? formulations[loaded.subject.formulationId] : null;
  return { subject: summarize(loaded.subject, subjectLabel), options: pickOptions(loaded.entries, loaded.subject, formulations) };
}

export async function compareMedicinesAction(input: { patientId: string; subject: CompareSubject; entryIds: string[] }): Promise<CompareResult | CompareError> {
  const parsed = compareSchema.safeParse(input);
  if (!parsed.success) return { error: "Pick at least one medicine to compare." };
  const loaded = await load(parsed.data.patientId, parsed.data.subject);
  if (!loaded) return NOT_FOUND;
  const confirmed = new Map(loaded.entries.filter((e) => e.status === "confirmed" && e.id !== loaded.subject.id).map((e) => [e.id, e]));
  const picked = [...new Set(parsed.data.entryIds)].map((id) => confirmed.get(id));
  if (picked.some((e) => !e)) return { error: "One of those medicines isn't saved and confirmed for this person." };
  const entries = [loaded.subject, ...(picked as MedicationEntry[])];
  const formulations = await getFormulationsByIds([...new Set(entries.flatMap((e) => (e.formulationId ? [e.formulationId] : [])))]);
  return { entries, formulations, runs: runChecks({ entries, formulations }) };
}
```

- [ ] **Step 2:** `npm run typecheck` and `npm run lint` pass.
- [ ] **Step 3: Commit** — `feat(compare): server actions: the medicines to pick, then runChecks() over the picks`

---

### Task 3: UI

**Files:** see the file map. Modify `warning-card.tsx` (add `label?: string`, `children?: ReactNode`, `headingLevel?: "h3" | "h4"`) and `medicine-card-sheet.tsx` (add `actions?: ReactNode`, `defaultTab?: CardTab`, passed to `MedicineCard`).

**Interfaces:**
- `CompareButton({ patientId, subject }: { patientId: string; subject: CompareSubject })`: calls `compareChoicesAction` on mount. Renders nothing until loaded, and nothing when `options` is empty or on error.
- `CompareSheet({ patientId, subject, choices, open, onOpenChange })`
- `CompareResults({ patientId, result }: { patientId: string; result: CompareResult })`
- `ComparedCards({ cards })`, `ConcentrationBars({ bars })`, `CopyQuestion({ question })`, `LabelSheetButton({ formulation, name })`

Behaviour (spec §3):
1. **Sheet.** A `Dialog` styled like `MedicineCardSheet` (bottom sheet on phones, centered `sm:max-w-2xl`), titled "Compare with my medicines".
   - `useBackToClose(open, () => onOpenChange(false))`
   - `useBackToClose(open && step === "results", () => setStep("pick"))`
2. **Pick step.**
   - Caption: "MedCheck lines up what the labels say. It never says a combination is safe." This is the app's own boundary line and contains "safe" only as a negation.
   - **This medicine** accent card, then **Compare with (pick one or more)**: one `label` row per option, at least 44 px tall, with a native checkbox (`accent-primary`), name, the ingredients line, form and a status chip.
   - `waiting_for_review` options are disabled and show a "Check details" link to `draftPath`, with `release()` + `replace`.
   - **Check before comparing**: each picked option's ingredient, strength and form. Any value needing confirmation shows a violet "Needs confirmation" chip and a **Review it →** link to `/patients/{pid}/entries/{id}/review?from=entry` (`release()` + `replace`).
   - Sticky footer: **Compare N medicines**, disabled until something is picked, with the pending label "Comparing…".
3. **Results step.**
   - A header back button, "← Change medicines" (`history.back()`, so the `useBackToClose` entry pops).
   - `CompareResults`: `ComparedCards`, then **Together** (`IngredientComparison products={view.products}`), then **What the labels show** (one `WarningCard` per finding, with `label={f.label}`, `headingLevel="h4"`).
   - Inside each card: `ConcentrationBars` when `bars`, `CopyQuestion`, and **Inspect labels** (a `LabelSheetButton` per evidence entry with a formulation, deduped).
   - **Unable to complete comparison** cards (violet) listing `reasons`.
   - **Checks run** rows, then `NOT_SAFE_LINE`.
   - Loading shows a skeleton. An error shows "Couldn't compare these medicines. Try again." with **Try again**.
4. **Wiring.**
   - `MedicineCardButton` gains an `entryId` prop and passes `actions={<CompareButton patientId subject={{ entryId }} />}` to its sheet. The entry page passes `entryId={entry.id}`, but only for confirmed entries.
   - `AnswerResult` gains a `patientId` prop. `AnswerBody` passes `actions={<CompareButton patientId subject={{ entryId: answer.key, formulationId: answer.formulation.id }} />}`. `photo-answers-dialog.tsx` passes `patientId`.

- [ ] **Step 1:** Write the components (code in the commit; follow the existing sheet/dialog and card class patterns).
- [ ] **Step 2:** `npm run lint && npm run typecheck && npm test` pass.
- [ ] **Step 3: Commit** — `feat(compare): Compare with my medicines: pick, review, then side-by-side findings`

---

### Task 4: e2e, docs, browser check

- [ ] **Step 1: e2e.** A new `test.describe("compare with my medicines")` with its own guest (`beforeAll`/`afterAll` like the photo describe), so a failure elsewhere can't skip it:
  1. `readPackagePhoto(page, browser, base, "tylenolExtraStrength")`, **Continue**, **Save to My medicines**.
  2. `addMedicineByPhoto(page, browser, base, "Store pain relief caplets")`: acetaminophen 500 mg per caplet, typed.
  3. Open the Tylenol entry from My medicines, then **View medicine card** → **Compare with my medicines**.
  4. Expect "Store pain relief caplets" listed. Check it, then **Compare 2 medicines**.
  5. Expect "Shared ingredient identified", the Together heading, a **Copy question** button, and the fixed `NOT_SAFE_LINE`. Expect no "safe" outside that line.
  6. `page.goBack()` returns to the picker with "Store pain relief caplets" still checked.
- [ ] **Step 2: AGENTS.md.** Add the compare spec to the "Read …" list. Add `src/lib/compare-view.ts` and `src/components/compare/compare-sheet.tsx` to the code map.
- [ ] **Step 3:** `npm run build`, then a Playwright browser check at 390 and 1280 px in light and dark: the pick list, the review summary, results, Copy, Inspect labels, Back. Zero console errors. Then `E2E_PORT=3170 FAKE_GEMINI_PORT=4970 npx playwright test --grep "compare with my medicines"`.
- [ ] **Step 4: Commit** — `test(e2e): compare with my medicines; docs: map the compare sheet`

### Task 5: Ship
Merge `origin/dev`, rerun the gate, push, open the PR `--base dev`, wait for `verify` and `e2e`, then merge.
