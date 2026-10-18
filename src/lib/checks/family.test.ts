import { describe, expect, it } from "vitest";
import { advil, advilPm, aleve, aleveNoLabel, FAMILY_FORMULATIONS, motrin, NSAID_OTHER_DRUGS, nyquil, tylenol } from "@/lib/__fixtures__/family-formulations";
import demoRows from "@/lib/__fixtures__/demo-products.json";
import type { Formulation, MedicationEntry } from "@/lib/domain/schema";
import { edited, makeEntry, pending } from "./__fixtures__/entries";
import { checkIngredientFamily } from "./family";

/** A confirmed catalog entry for a formulation, as the barcode/picker flow saves it. */
function fromCatalog(id: string, f: Formulation, overrides: Partial<Parameters<typeof makeEntry>[0]> = {}): MedicationEntry {
  return makeEntry({
    id,
    name: f.brandName,
    form: f.dosageForm,
    ingredients: f.activeIngredients.map((i) => ({ name: i.name, strength: i.strength })),
    formulationId: f.id,
    inputMethod: "picker",
    ...overrides,
  });
}

/** Real catalog rows (live import, October 2026), copied verbatim. */
const demo = demoRows as unknown as Record<keyof typeof demoRows, Formulation>;

const run = (...entries: MedicationEntry[]) => checkIngredientFamily({ entries, formulations: FAMILY_FORMULATIONS });

describe("ingredient family", () => {
  it("finds two NSAIDs in different medicines, quoting the label that names the family", () => {
    const r = run(fromCatalog("e-advil", advil), fromCatalog("e-aleve", aleve));
    expect(r.check).toBe("ingredient_family");
    expect(r.status).toBe("finding");
    expect(r.summary).toBe("Found 1 shared family of medicine");
    expect(r.findings).toHaveLength(1);
    const f = r.findings[0];
    expect(f.id).toBe("ingredient_family:e-advil,e-aleve:nsaid");
    expect(f.title).toBe("Advil and Aleve both contain NSAIDs");
    expect(f.detail).toBe(
      "Advil lists Ibuprofen 200 mg per tablet. Aleve lists Naproxen sodium 220 mg per caplet. Ibuprofen and naproxen are different active ingredients, both NSAIDs.",
    );
    expect(f.labelWarningQuote).toBe(NSAID_OTHER_DRUGS);
    expect(f.evidence.map((e) => [e.entryId, e.field, e.text])).toEqual([
      ["e-advil", "ingredients[0].name", "Ibuprofen 200 mg per tablet"],
      ["e-aleve", "ingredients[0].name", "Naproxen sodium 220 mg per caplet"],
    ]);
    expect(f.pharmacistQuestion).toBe(
      "Advil contains ibuprofen and Aleve contains naproxen, and both are NSAIDs. Can they be used together, and what should I watch for?",
    );
  });

  it("takes the quote from whichever medicine has a catalog label", () => {
    const typedNaproxen = makeEntry({
      id: "e-rx-naproxen",
      name: "Naproxen",
      form: "tablet",
      ingredients: [{ name: "Naproxen sodium", strength: { amount: 220, unit: "mg", perAmount: 1, perUnit: "tablet" } }],
      doc: { kind: "prescription_label" },
    });
    const r = run(typedNaproxen, fromCatalog("e-advil", advil));
    expect(r.findings[0].labelWarningQuote).toBe(NSAID_OTHER_DRUGS);
    expect(r.findings[0].title).toBe("Naproxen and Advil both contain NSAIDs");
  });

  it("reports nothing when no label on file names the family", () => {
    const r = run(fromCatalog("e-aleve", aleveNoLabel), fromCatalog("e-advil", { ...advil, id: "f-x" }, { formulationId: null }));
    expect(r.status).toBe("no_finding");
    expect(r.summary).toBe("No two medicines from the same family found in confirmed fields");
  });

  it("leaves the same ingredient twice to the overlap check", () => {
    expect(run(fromCatalog("e-advil", advil), fromCatalog("e-motrin", motrin)).status).toBe("no_finding");
  });

  it("counts a repeated product once", () => {
    expect(run(fromCatalog("e-advil", advil), fromCatalog("e-advil-2", advil)).status).toBe("no_finding");
  });

  it("names every product holding a member when there are three", () => {
    const r = run(fromCatalog("e-advil", advil), fromCatalog("e-motrin", motrin), fromCatalog("e-aleve", aleve));
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0].title).toBe("Advil, Motrin IB and Aleve all contain NSAIDs");
    expect(r.findings[0].entryIds).toEqual(["e-advil", "e-aleve", "e-motrin"]);
  });

  it("names a pair in two families once", () => {
    const r = run(fromCatalog("e-nyquil", nyquil), fromCatalog("e-advil-pm", advilPm));
    expect(r.findings.map((f) => [f.id, f.labelWarningQuote])).toEqual([["ingredient_family:e-advil-pm,e-nyquil:antihistamine", "taking any other antihistamines"]]);
  });

  describe("each label's own words", () => {
    const { midolComplete, benadryl, tylenolPm } = demo;
    const runDemo = (...entries: MedicationEntry[]) =>
      checkIngredientFamily({ entries, formulations: Object.fromEntries(Object.values(demo).map((f) => [f.id, f])) });

    it("finds two antihistamines when each label's Purpose says so", () => {
      const r = runDemo(fromCatalog("e-midol", midolComplete), fromCatalog("e-benadryl", benadryl));
      expect(r.status).toBe("finding");
      const f = r.findings[0];
      expect(f.id).toBe("ingredient_family:e-benadryl,e-midol:antihistamine");
      expect(f.title).toBe("Midol Complete and Benadryl both contain antihistamines");
      expect(f.detail).toBe(
        "Midol Complete lists Pyrilamine maleate 15 mg per caplet. Benadryl lists Diphenhydramine HCl 25 mg per tablet. " +
          "Pyrilamine and diphenhydramine are different active ingredients, both antihistamines. " +
          "Each label's own words: Midol Complete — Purpose: “Antihistamine”; Benadryl — Purpose: “Antihistamine”.",
      );
      // A Purpose line is not a warning.
      expect(f.labelWarningQuote).toBeNull();
      expect(f.pharmacistQuestion).toBe(
        "Midol Complete contains pyrilamine and Benadryl contains diphenhydramine, and both are antihistamines. Can they be used together, and what should I watch for?",
      );
    });

    it("needs every product's own catalog label", () => {
      const typed = fromCatalog("e-benadryl", benadryl, { formulationId: null });
      expect(runDemo(fromCatalog("e-midol", midolComplete), typed).status).toBe("no_finding");
      expect(runDemo(fromCatalog("e-midol", midolComplete), fromCatalog("e-tylenol-pm", tylenolPm)).findings).toEqual([]);
    });

    it("names only the products whose label says so", () => {
      const r = runDemo(fromCatalog("e-midol", midolComplete), fromCatalog("e-benadryl", benadryl), fromCatalog("e-tylenol-pm", tylenolPm));
      expect(r.findings.map((f) => f.title)).toEqual(["Midol Complete and Benadryl both contain antihistamines"]);
    });
  });

  it("marks a value the user typed", () => {
    const aleveTyped = fromCatalog("e-aleve", aleve, {
      ingredients: [{ name: edited("Naproxen", "Naproxen sodium", { kind: "photo", sourceDocumentId: "doc-e-aleve" }), strength: aleve.activeIngredients[0].strength }],
    });
    expect(run(fromCatalog("e-advil", advil), aleveTyped).findings[0].detail).toContain("Aleve lists Naproxen sodium 220 mg per caplet (you entered this).");
  });

  it("is unresolved when an ingredient isn't confirmed", () => {
    const pendingAleve = fromCatalog("e-aleve", aleve, {
      ingredients: [{ name: pending("Naproxen sodium", { kind: "database", formulationId: aleve.id }), strength: aleve.activeIngredients[0].strength }],
    });
    const r = run(fromCatalog("e-advil", advil), pendingAleve);
    expect(r.status).toBe("unresolved");
    expect(r.reasons[0]).toMatch(/^Active ingredient not confirmed yet/);
  });

  it("has nothing to compare with one medicine", () => {
    expect(run(fromCatalog("e-advil", advil)).status).toBe("not_applicable");
  });

  it("finds nothing for medicines from different families", () => {
    const r = run(fromCatalog("e-advil", advil), fromCatalog("e-tylenol", tylenol));
    expect(r.status).toBe("no_finding");
  });

  it("never says safe and never doses", () => {
    const text = JSON.stringify(run(fromCatalog("e-advil", advil), fromCatalog("e-aleve", aleve))).toLowerCase();
    expect(text).not.toMatch(/safe|doubl|twice the/);
  });
});
