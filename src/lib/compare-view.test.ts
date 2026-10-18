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
    const ours = [
      ...Object.values(FINDING_LABELS),
      NONE_FOUND,
      NOTHING_TO_COMPARE,
      CONCENTRATION_SENTENCE,
      ...v.cards.map((c) => c.source),
      ...v.checksRun.map((c) => c.title),
    ];
    for (const s of ours) expect(s).not.toMatch(/\bsafe\b/i);
    expect(NOT_SAFE_LINE).toBe("“None found” only means none in the confirmed fields. It doesn't mean safe.");
  });
});
