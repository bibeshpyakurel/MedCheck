import { describe, expect, it } from "vitest";
import {
  isReadable,
  photoReadFromFields,
  preselectMatch,
  rankCatalogMatches,
  searchTermsFor,
  type PhotoRead,
} from "./catalog-match";
import { emptyEntryFields, suggestedField } from "./domain/fields";
import type { CatalogIngredient, Formulation, Strength } from "./domain/schema";

// ---------------------------------------------------------------------------
// Fixtures: realistic catalog rows, strengths as the NDC Directory gives them.
// ---------------------------------------------------------------------------

const s = (amount: number, unit: Strength["unit"], perAmount: number | null, perUnit: string | null): Strength => ({
  amount,
  unit,
  perAmount,
  perUnit,
});
const ing = (name: string, normalized: string, strength: Strength): CatalogIngredient => ({ name, normalized, strength });

function formulation(
  id: string,
  brandName: string,
  genericName: string,
  dosageForm: string,
  activeIngredients: CatalogIngredient[],
  reviewed = false,
): Formulation {
  return {
    id,
    slug: `otc-${id}`,
    brandName,
    genericName,
    dosageForm,
    isFictional: false,
    ndcPackages: [],
    activeIngredients,
    directionsText: null,
    max24hText: null,
    warningsQuotes: [],
    dosageTableHtml: null,
    source: "openfda",
    openfdaSetId: id,
    labelEffectiveDate: null,
    labelerName: null,
    labelSections: {},
    sourceLinks: [],
    reviewed,
  };
}

const APAP = (st: Strength) => ing("Acetaminophen", "acetaminophen", st);
const DXM = (st: Strength) => ing("Dextromethorphan HBr", "dextromethorphan", st);
const DOXY = (st: Strength) => ing("Doxylamine succinate", "doxylamine", st);

const tylenolExtra = formulation("f-tylenol-es", "Tylenol Extra Strength", "Acetaminophen", "TABLET, COATED", [APAP(s(500, "mg", 1, "tablet"))], true);
const tylenolRegular = formulation("f-tylenol-reg", "Tylenol Regular Strength", "Acetaminophen", "TABLET", [APAP(s(325, "mg", 1, "tablet"))]);
const childrensTylenol = formulation("f-childrens-tylenol", "Children's TYLENOL", "Acetaminophen", "SUSPENSION", [APAP(s(160, "mg", 5, "mL"))]);
const storeApap = formulation("f-store-apap", "Good Neighbor Pharmacy Extra Strength Pain Relief", "Acetaminophen", "TABLET", [APAP(s(500, "mg", 1, "1"))]);
const advil = formulation("f-advil", "Advil", "Ibuprofen", "CAPSULE, LIQUID FILLED", [ing("Ibuprofen", "ibuprofen", s(200, "mg", 1, "capsule"))]);
const childrensAdvil = formulation("f-childrens-advil", "Children's Advil", "Ibuprofen", "SUSPENSION", [ing("Ibuprofen", "ibuprofen", s(100, "mg", 5, "mL"))]);
const nyquil = formulation("f-nyquil", "Vicks NyQuil Cold & Flu", "Acetaminophen, Dextromethorphan HBr, Doxylamine succinate", "LIQUID", [
  APAP(s(650, "mg", 30, "mL")),
  DXM(s(30, "mg", 30, "mL")),
  DOXY(s(12.5, "mg", 30, "mL")),
]);
const nyquilSevere = formulation("f-nyquil-severe", "Vicks NyQuil Severe Cold & Flu", "Acetaminophen, Dextromethorphan HBr, Doxylamine succinate, Phenylephrine HCl", "LIQUID", [
  APAP(s(650, "mg", 30, "mL")),
  DXM(s(20, "mg", 30, "mL")),
  DOXY(s(12.5, "mg", 30, "mL")),
  ing("Phenylephrine HCl", "phenylephrine", s(10, "mg", 30, "mL")),
]);

const CATALOG = [tylenolExtra, tylenolRegular, childrensTylenol, storeApap, advil, childrensAdvil, nyquil, nyquilSevere];

function read(
  productName: string | null,
  dosageForm: string | null,
  ingredients: [string | null, Strength | null][],
): PhotoRead {
  return { productName, dosageForm, ingredients: ingredients.map(([name, strength]) => ({ name, strength })) };
}

const ids = (r: PhotoRead, candidates = CATALOG) => rankCatalogMatches(r, candidates).map((m) => m.formulation.id);

// ---------------------------------------------------------------------------

describe("photoReadFromFields", () => {
  it("takes what Gemini read, falling back to the current value", () => {
    const fields = emptyEntryFields();
    fields.productName = suggestedField("  Children's TYLENOL ", { kind: "none" });
    fields.dosageForm = { aiValue: null, value: "suspension", state: "edited", evidence: { kind: "none" } };
    fields.ingredients = [
      { name: suggestedField("Acetaminophen", { kind: "none" }), strength: suggestedField(s(160, "mg", 5, "mL"), { kind: "none" }) },
      { name: suggestedField<string>(null, { kind: "none" }), strength: suggestedField<Strength>(null, { kind: "none" }) },
    ];
    expect(photoReadFromFields(fields)).toEqual({
      productName: "Children's TYLENOL",
      dosageForm: "suspension",
      ingredients: [{ name: "Acetaminophen", strength: s(160, "mg", 5, "mL") }],
    });
  });

  it("prefers the AI value over an edited value", () => {
    const fields = emptyEntryFields();
    fields.productName = { aiValue: "Advil", value: "Motrin", state: "edited", evidence: { kind: "none" } };
    expect(photoReadFromFields(fields).productName).toBe("Advil");
  });
});

describe("isReadable", () => {
  it("is false with no product name and no ingredient name", () => {
    expect(isReadable(read(null, "tablet", [[null, s(500, "mg", 1, "tablet")]]))).toBe(false);
    expect(isReadable(read("   ", null, []))).toBe(false);
  });
  it("is true with a product name or an ingredient name", () => {
    expect(isReadable(read("Advil", null, []))).toBe(true);
    expect(isReadable(read(null, null, [["Ibuprofen", null]]))).toBe(true);
  });
});

describe("rankCatalogMatches", () => {
  it("pre-selects the exact match", () => {
    const r = read("TYLENOL Extra Strength", "caplets", [["Acetaminophen", s(500, "mg", 1, "caplet")]]);
    const matches = rankCatalogMatches(r, CATALOG);
    expect(matches[0].formulation.id).toBe("f-tylenol-es");
    expect(matches[0].strengthAgreement).toBe("agrees");
    expect(preselectMatch(matches)?.formulation.id).toBe("f-tylenol-es");
  });

  it("treats caplet, tablet and a bare '/1' as the same single unit", () => {
    const r = read(null, null, [["Acetaminophen", s(500, "mg", 1, "caplet")]]);
    const byId = Object.fromEntries(rankCatalogMatches(r, CATALOG).map((m) => [m.formulation.id, m.strengthAgreement]));
    expect(byId["f-tylenol-es"]).toBe("agrees");
    expect(byId["f-store-apap"]).toBe("agrees");
    expect(byId["f-tylenol-reg"]).toBe("disagrees");
  });

  it("never pre-selects a candidate whose strength disagrees with the photo, even with the better brand", () => {
    const r = read("Tylenol Extra Strength", "tablet", [["Acetaminophen", s(325, "mg", 1, "tablet")]]);
    const matches = rankCatalogMatches(r, CATALOG);
    const extra = matches.find((m) => m.formulation.id === "f-tylenol-es")!;
    expect(extra.strengthAgreement).toBe("disagrees");
    expect(preselectMatch(matches)?.formulation.id).toBe("f-tylenol-reg");
    expect(preselectMatch(matches)?.strengthAgreement).toBe("agrees");
  });

  it("never pre-selects a product that shares nothing with the read", () => {
    const matches = rankCatalogMatches(read("Advil", null, []), [tylenolRegular, childrensTylenol]);
    expect(matches[0].strengthAgreement).toBe("not_read");
    expect(matches[0].related).toBe(false);
    expect(preselectMatch(matches)).toBeNull();
  });

  it("pre-selects on a good brand match alone", () => {
    const matches = rankCatalogMatches(read("Childrens Advil", null, []), [tylenolRegular, childrensAdvil]);
    expect(preselectMatch(matches)?.formulation.id).toBe("f-childrens-advil");
    // Half the tokens shared is enough: {tylenol} vs {tylenol, extra, strength} has Dice 0.5.
    expect(preselectMatch(rankCatalogMatches(read("Tylenol", null, []), [tylenolExtra]))?.formulation.id).toBe("f-tylenol-es");
  });

  it("pre-selects on a shared ingredient alone", () => {
    const matches = rankCatalogMatches(read(null, null, [["Ibuprofen", null]]), [childrensTylenol, advil]);
    expect(preselectMatch(matches)?.formulation.id).toBe("f-advil");
  });

  it("pre-selects nothing when every candidate disagrees", () => {
    const r = read("Tylenol", null, [["Acetaminophen", s(1000, "mg", 1, "tablet")]]);
    expect(preselectMatch(rankCatalogMatches(r, [tylenolExtra, tylenolRegular]))).toBeNull();
  });

  it("compares liquids by mg per mL (32 mg/1 mL == 160 mg/5 mL)", () => {
    const r = read("Childrens Tylenol", "oral suspension", [["Acetaminophen", s(32, "mg", 1, "mL")]]);
    const matches = rankCatalogMatches(r, CATALOG);
    expect(matches[0].formulation.id).toBe("f-childrens-tylenol");
    expect(matches[0].strengthAgreement).toBe("agrees");
  });

  it("converts mass units (0.5 g == 500 mg) and tells concentrations apart", () => {
    const grams = read(null, null, [["Acetaminophen", s(0.5, "g", 1, "tablet")]]);
    expect(rankCatalogMatches(grams, [tylenolExtra])[0].strengthAgreement).toBe("agrees");
    const infants = read("Advil", null, [["Ibuprofen", s(50, "mg", 1.25, "mL")]]);
    expect(rankCatalogMatches(infants, [childrensAdvil])[0].strengthAgreement).toBe("disagrees");
  });

  it("does not equate a per-tablet strength with a per-mL one", () => {
    const r = read(null, null, [["Ibuprofen", s(100, "mg", 5, "mL")]]);
    expect(rankCatalogMatches(r, [advil])[0].strengthAgreement).toBe("disagrees");
  });

  it("with no strength read, pre-selects the best brand match as not_read", () => {
    const r = read("Childrens Tylenol", null, [["Acetaminophen", null]]);
    const matches = rankCatalogMatches(r, CATALOG);
    expect(matches[0].formulation.id).toBe("f-childrens-tylenol");
    expect(matches[0].strengthAgreement).toBe("not_read");
    expect(preselectMatch(matches)?.formulation.id).toBe("f-childrens-tylenol");
  });

  it("brand similarity ignores case and punctuation", () => {
    const r = read("CHILDRENS ADVIL", null, []);
    expect(ids(r)[0]).toBe("f-childrens-advil");
  });

  it("a read ingredient missing from the label disagrees", () => {
    const r = read("NyQuil", null, [["Acetaminophen", null], ["Dextromethorphan HBr", null], ["Doxylamine succinate", null]]);
    const byId = Object.fromEntries(rankCatalogMatches(r, CATALOG).map((m) => [m.formulation.id, m.strengthAgreement]));
    expect(byId["f-tylenol-es"]).toBe("disagrees");
    expect(byId["f-nyquil"]).toBe("not_read");
  });

  it("an exact ingredient set beats a label that has more ingredients", () => {
    const r = read(null, "liquid", [["Acetaminophen", null], ["Dextromethorphan", null], ["Doxylamine", null]]);
    const order = ids(r);
    expect(order[0]).toBe("f-nyquil");
    expect(order.indexOf("f-nyquil")).toBeLessThan(order.indexOf("f-nyquil-severe"));
  });

  it("multi-ingredient strengths must all agree", () => {
    const r = read("NyQuil Cold & Flu", "liquid", [
      ["Acetaminophen", s(650, "mg", 30, "mL")],
      ["Dextromethorphan HBr", s(30, "mg", 30, "mL")],
      ["Doxylamine succinate", s(12.5, "mg", 30, "mL")],
    ]);
    const matches = rankCatalogMatches(r, CATALOG);
    const byId = Object.fromEntries(matches.map((m) => [m.formulation.id, m.strengthAgreement]));
    expect(byId["f-nyquil"]).toBe("agrees");
    expect(byId["f-nyquil-severe"]).toBe("disagrees"); // 20 mg dextromethorphan, and an extra ingredient
    expect(preselectMatch(matches)?.formulation.id).toBe("f-nyquil");
  });

  it("deduplicates candidates by formulation id", () => {
    const matches = rankCatalogMatches(read("Advil", null, []), [advil, childrensAdvil, advil, { ...advil }]);
    expect(matches.map((m) => m.formulation.id).sort()).toEqual(["f-advil", "f-childrens-advil"]);
  });

  it("is deterministic: same order whatever the candidate order, ties broken by id", () => {
    const r = read(null, null, [["Acetaminophen", null]]);
    const forward = ids(r);
    expect(ids(r, [...CATALOG].reverse())).toEqual(forward);
    const twinA = formulation("b-twin", "Pain Relief", "Acetaminophen", "TABLET", [APAP(s(500, "mg", 1, "tablet"))]);
    const twinB = { ...twinA, id: "a-twin" };
    expect(rankCatalogMatches(r, [twinA, twinB]).map((m) => m.formulation.id)).toEqual(["a-twin", "b-twin"]);
  });

  it("gives hand-checked rows a small boost", () => {
    const unreviewed = { ...tylenolExtra, id: "a-copy", reviewed: false };
    const r = read("Tylenol Extra Strength", null, [["Acetaminophen", s(500, "mg", 1, "caplet")]]);
    expect(ids(r, [unreviewed, tylenolExtra])).toEqual(["f-tylenol-es", "a-copy"]);
  });
});

describe("searchTermsFor", () => {
  it("lists the brand as read, then each ingredient name, without repeats", () => {
    const r = read("Children's TYLENOL", null, [["Acetaminophen USP", s(160, "mg", 5, "mL")], ["acetaminophen", null], [null, null]]);
    expect(searchTermsFor(r)).toEqual(["Children's TYLENOL", "acetaminophen"]);
  });
  it("skips a brand that is just the ingredient name", () => {
    expect(searchTermsFor(read("Acetaminophen", null, [["Acetaminophen", null]]))).toEqual(["Acetaminophen"]);
  });
  it("is empty for an unreadable read", () => {
    expect(searchTermsFor(read(null, null, []))).toEqual([]);
  });
  it("adds the brand alone, without strength, marketing or form words, right after the read", () => {
    expect(searchTermsFor(read("Rolaids Extra Strength", null, []))).toEqual(["Rolaids Extra Strength", "Rolaids"]);
    expect(searchTermsFor(read("Zantac 360 Maximum Strength", null, []))).toEqual(["Zantac 360 Maximum Strength", "Zantac 360"]);
    expect(searchTermsFor(read("Pepcid AC 10 mg Original Strength", null, []))).toEqual(["Pepcid AC 10 mg Original Strength", "Pepcid AC"]);
    expect(searchTermsFor(read("Advil Liqui-Gels", null, []))).toEqual(["Advil Liqui-Gels", "Advil"]);
  });
  it("adds no brand-only term when nothing is left or nothing changes", () => {
    expect(searchTermsFor(read("Extra Strength", null, []))).toEqual(["Extra Strength"]);
    expect(searchTermsFor(read("Claritin", null, []))).toEqual(["Claritin"]);
  });
});
