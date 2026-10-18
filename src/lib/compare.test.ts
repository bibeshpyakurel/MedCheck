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
import { compareProducts } from "./compare";

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
        labelQuote: NSAID_OTHER_DRUGS,
      },
    ]);
  });

  it("takes the family quote from whichever member's label has one", () => {
    const c = compareProducts([aleveNoLabel, advil]);
    expect(c.families).toHaveLength(1);
    expect(c.families[0].labelQuote).toBe(NSAID_OTHER_DRUGS);
  });

  it("shows no family when no label names it", () => {
    const bareAdvil = { ...advil, labelSections: {}, warningsQuotes: [] };
    expect(compareProducts([bareAdvil, aleveNoLabel]).families).toEqual([]);
    // Both PPI labels only say "Acid reducers may interact with certain prescription drugs."
    expect(compareProducts([prilosec, nexium]).families).toEqual([]);
  });

  it("finds acid reducers through Pepcid's 'with other acid reducers'", () => {
    const c = compareProducts([prilosec, pepcid]);
    expect(c.families.map((f) => [f.familyId, f.labelQuote])).toEqual([["acid_reducer", "with other acid reducers"]]);
  });

  it("names a pair once even when it is in two families", () => {
    // Doxylamine and diphenhydramine are antihistamines and sleep aids; Advil PM names both.
    const c = compareProducts([nyquil, advilPm]);
    expect(c.families.map((f) => [f.familyId, f.labelQuote])).toEqual([["antihistamine", "taking any other antihistamines"]]);
    expect(c.families[0].members.map((m) => m.normalized)).toEqual(["doxylamine", "diphenhydramine"]);
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
