import { describe, expect, it } from "vitest";
import {
  ACETAMINOPHEN_DO_NOT_USE,
  advil,
  advilPm,
  aleve,
  aleveNoLabel,
  motrin,
  nexium,
  NSAID_OTHER_DRUGS,
  nyquil,
  pepcid,
  prilosec,
  tylenol,
} from "./__fixtures__/family-formulations";
import demoRows from "./__fixtures__/demo-products.json";
import { compareProducts } from "./compare";
import type { Formulation } from "./domain/schema";

/** Real catalog rows for the demo packages (live import, October 2026), copied verbatim. */
const demo = demoRows as unknown as Record<keyof typeof demoRows, Formulation>;

describe("compareProducts", () => {
  it("lists each product's ingredients with their strength, nothing shared", () => {
    const c = compareProducts([advil, tylenol]);
    expect(c.products).toEqual([
      { id: "f-advil", name: "Advil" },
      { id: "f-tylenol", name: "Tylenol Extra Strength" },
    ]);
    expect(c.ingredients).toEqual([
      { normalized: "ibuprofen", displayName: "Ibuprofen", perProduct: ["200 mg per tablet", null] },
      { normalized: "acetaminophen", displayName: "Acetaminophen", perProduct: [null, "500 mg per caplet"] },
    ]);
    expect(c.shared).toEqual([]);
    expect(c.families).toEqual([]);
  });

  it("reports an ingredient two products share, with the label's 'other drugs containing' line", () => {
    const c = compareProducts([advil, motrin]);
    expect(c.shared).toEqual([
      { normalized: "ibuprofen", displayName: "Ibuprofen", productIds: ["f-advil", "f-motrin"], labelQuote: NSAID_OTHER_DRUGS },
    ]);
    expect(c.ingredients).toEqual([{ normalized: "ibuprofen", displayName: "Ibuprofen", perProduct: ["200 mg per tablet", "200 mg per caplet"] }]);
    // The same ingredient twice is shared, never a family.
    expect(c.families).toEqual([]);
  });

  it("prefers the full 'Do not use with any other drug containing' sentence", () => {
    const c = compareProducts([nyquil, tylenol]);
    expect(c.shared).toHaveLength(1);
    expect(c.shared[0].normalized).toBe("acetaminophen");
    // NyQuil's do_not_use bullet lost its heading; Tylenol's warningsQuotes keep the whole sentence.
    expect(c.shared[0].labelQuote).toBe(ACETAMINOPHEN_DO_NOT_USE);
  });

  it("falls back to the first bullet mentioning the ingredient", () => {
    const onlyMention = { ...tylenol, id: "t2", labelSections: { warnings: ["Liver warning This product contains acetaminophen."] }, warningsQuotes: [] };
    const c = compareProducts([onlyMention, { ...onlyMention, id: "t3" }]);
    expect(c.shared[0].labelQuote).toBe("Liver warning This product contains acetaminophen.");
  });

  it("has no quote when no label mentions the shared ingredient", () => {
    const bare = { ...tylenol, id: "t4", labelSections: {}, warningsQuotes: [] };
    expect(compareProducts([bare, { ...bare, id: "t5" }]).shared[0].labelQuote).toBeNull();
  });

  it("joins two NSAIDs by the label's own sentence naming the family", () => {
    const c = compareProducts([advil, aleve]);
    expect(c.shared).toEqual([]);
    expect(c.ingredients.map((i) => i.normalized)).toEqual(["ibuprofen", "naproxen"]);
    expect(c.families).toEqual([
      {
        familyId: "nsaid",
        name: "NSAIDs",
        members: [
          { normalized: "ibuprofen", displayName: "Ibuprofen", productId: "f-advil" },
          { normalized: "naproxen", displayName: "Naproxen sodium", productId: "f-aleve" },
        ],
        evidence: { kind: "warning", quote: NSAID_OTHER_DRUGS },
      },
    ]);
  });

  it("takes the family quote from whichever member's label has one", () => {
    const c = compareProducts([aleveNoLabel, advil]);
    expect(c.families).toHaveLength(1);
    expect(c.families[0].evidence).toEqual({ kind: "warning", quote: NSAID_OTHER_DRUGS });
  });

  it("shows no family when no label names it", () => {
    const bareAdvil = { ...advil, labelSections: {}, warningsQuotes: [] };
    expect(compareProducts([bareAdvil, aleveNoLabel]).families).toEqual([]);
    // Both PPI labels only say "Acid reducers may interact with certain prescription drugs."
    expect(compareProducts([prilosec, nexium]).families).toEqual([]);
  });

  it("finds acid reducers through Pepcid's 'with other acid reducers'", () => {
    const c = compareProducts([prilosec, pepcid]);
    expect(c.families.map((f) => [f.familyId, f.evidence])).toEqual([["acid_reducer", { kind: "warning", quote: "with other acid reducers" }]]);
  });

  it("names a pair once even when it is in two families", () => {
    // Doxylamine and diphenhydramine are antihistamines and sleep aids; Advil PM names both.
    const c = compareProducts([nyquil, advilPm]);
    expect(c.families.map((f) => [f.familyId, f.evidence])).toEqual([["antihistamine", { kind: "warning", quote: "taking any other antihistamines" }]]);
    expect(c.families[0].members.map((m) => m.normalized)).toEqual(["doxylamine", "diphenhydramine"]);
  });

  describe("each label's own words (Purpose, NSAID footnote)", () => {
    const { midolComplete, benadryl, tylenolPm, alevePm } = demo;

    it("joins two antihistamines when each label's Purpose says so", () => {
      const c = compareProducts([midolComplete, benadryl]);
      expect(c.families).toEqual([
        {
          familyId: "antihistamine",
          name: "antihistamines",
          members: [
            { normalized: "pyrilamine", displayName: "Pyrilamine maleate", productId: midolComplete.id },
            { normalized: "diphenhydramine", displayName: "Diphenhydramine HCl", productId: benadryl.id },
          ],
          evidence: {
            kind: "own_labels",
            quotes: [
              { product: midolComplete.id, heading: "Purpose", quote: "Antihistamine" },
              { product: benadryl.id, heading: "Purpose", quote: "Antihistamine" },
            ],
          },
        },
      ]);
    });

    it("needs both labels: one Purpose alone is not enough", () => {
      // Tylenol PM's Purpose is "Pain reliever", "Nighttime sleep aid": not an antihistamine in its own words.
      expect(compareProducts([midolComplete, tylenolPm]).families).toEqual([]);
      const noPurpose = { ...benadryl, labelSections: { ...benadryl.labelSections, purpose: undefined } };
      expect(compareProducts([midolComplete, noPurpose]).families).toEqual([]);
    });

    it("prefers a label's warning naming the family over the Purpose lines", () => {
      const c = compareProducts([midolComplete, alevePm]);
      expect(c.families.map((f) => [f.familyId, f.evidence])).toEqual([["antihistamine", { kind: "warning", quote: "taking any other antihistamines" }]]);
    });

    it("takes a Purpose only when it fits exactly one of the label's ingredients in that family", () => {
      // A label with two antihistamines: "Antihistamine" can't say which one it means.
      const two = {
        ...midolComplete,
        id: "f-two-antihistamines",
        activeIngredients: [...midolComplete.activeIngredients, { name: "Chlorpheniramine maleate", normalized: "chlorpheniramine", strength: { amount: 2, unit: "mg" as const, perAmount: 1, perUnit: "tablet" } }],
      };
      expect(compareProducts([two, benadryl]).families).toEqual([]);
    });

    it("keeps the members whose own label names the family, drops the others", () => {
      // Benadryl and Tylenol PM share diphenhydramine; only Midol's and Benadryl's labels say antihistamine.
      const c = compareProducts([midolComplete, benadryl, tylenolPm]);
      expect(c.families).toHaveLength(1);
      expect(c.families[0].members.map((m) => m.productId)).toEqual([midolComplete.id, benadryl.id]);
      expect(c.families[0].evidence.kind).toBe("own_labels");
    });

    it("reads an NSAID from '(NSAID)' or 'nonsteroidal anti-inflammatory drug' anywhere on the label", () => {
      const strip = (f: Formulation, purpose: string[]): Formulation => ({ ...f, warningsQuotes: [], labelSections: { purpose } });
      const ibuprofen = strip(demo.motrinIb, ["Pain reliever/fever reducer (NSAID)*", "*nonsteroidal anti-inflammatory drug"]);
      const c = compareProducts([ibuprofen, strip(alevePm, alevePm.labelSections.purpose!)]);
      expect(c.families.map((f) => [f.familyId, f.evidence])).toEqual([
        [
          "nsaid",
          {
            kind: "own_labels",
            quotes: [
              { product: demo.motrinIb.id, heading: "Purpose", quote: "Pain reliever/fever reducer (NSAID)*" },
              { product: alevePm.id, heading: "Purpose", quote: "nonsteroidal anti-inflammatory drug Pain reliever" },
            ],
          },
        ],
      ]);
      // "Pain reliever/fever reducer" alone names no family.
      expect(compareProducts([strip(demo.motrinIb, ["Pain reliever/fever reducer"]), strip(alevePm, alevePm.labelSections.purpose!)]).families).toEqual([]);
    });

    it("finds a Purpose line naming more than one purpose", () => {
      const combined = { ...midolComplete, labelSections: { ...midolComplete.labelSections, purpose: ["Pain reliever Diuretic Antihistamine"] } };
      expect(compareProducts([combined, benadryl]).families[0].evidence).toEqual({
        kind: "own_labels",
        quotes: [
          { product: midolComplete.id, heading: "Purpose", quote: "Pain reliever Diuretic Antihistamine" },
          { product: benadryl.id, heading: "Purpose", quote: "Antihistamine" },
        ],
      });
    });
  });

  it("puts shared rows first in a three-product grid", () => {
    const c = compareProducts([nyquil, tylenol, advil]);
    expect(c.products.map((p) => p.name)).toEqual(["NyQuil Cold & Flu", "Tylenol Extra Strength", "Advil"]);
    expect(c.ingredients).toEqual([
      { normalized: "acetaminophen", displayName: "Acetaminophen", perProduct: ["325 mg per caplet", "500 mg per caplet", null] },
      { normalized: "dextromethorphan", displayName: "Dextromethorphan HBr", perProduct: ["10 mg per caplet", null, null] },
      { normalized: "doxylamine", displayName: "Doxylamine succinate", perProduct: ["6.25 mg per caplet", null, null] },
      { normalized: "ibuprofen", displayName: "Ibuprofen", perProduct: [null, null, "200 mg per tablet"] },
    ]);
    expect(c.shared.map((s) => [s.normalized, s.productIds])).toEqual([["acetaminophen", ["f-nyquil", "f-tylenol"]]]);
  });

  it("reports both the shared ingredient and the family across three products", () => {
    const c = compareProducts([advil, motrin, aleve]);
    expect(c.shared.map((s) => s.normalized)).toEqual(["ibuprofen"]);
    expect(c.families).toHaveLength(1);
    expect(c.families[0].members.map((m) => `${m.normalized}@${m.productId}`)).toEqual(["ibuprofen@f-advil", "ibuprofen@f-motrin", "naproxen@f-aleve"]);
  });

  it("counts a product given twice once", () => {
    const c = compareProducts([advil, advil]);
    expect(c.products).toHaveLength(1);
    expect(c.shared).toEqual([]);
  });

  it("never says safe", () => {
    const text = JSON.stringify([compareProducts([advil, tylenol]), compareProducts([advil, aleve])]).toLowerCase();
    expect(text).not.toContain("safe");
  });
});
