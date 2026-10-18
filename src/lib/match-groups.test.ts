import { describe, expect, it } from "vitest";
import type { CatalogMatch } from "./catalog-match";
import type { CatalogIngredient, Formulation, Strength } from "./domain/schema";
import { distinctMatches } from "./match-groups";

const s = (amount: number, unit: Strength["unit"], perAmount: number | null, perUnit: string | null): Strength => ({ amount, unit, perAmount, perUnit });
const ing = (name: string, strength: Strength, normalized = ""): CatalogIngredient => ({ name, normalized, strength });

function row(id: string, brandName: string, dosageForm: string, activeIngredients: CatalogIngredient[], labelerName: string | null = null): Formulation {
  return {
    id,
    slug: `otc-${id}`,
    brandName,
    genericName: activeIngredients.map((i) => i.name).join(", "),
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
    labelerName,
    labelSections: {},
    sourceLinks: [],
    reviewed: false,
  };
}

/** Matches in the order given (that order is the rank). */
const ranked = (...formulations: Formulation[]): CatalogMatch[] =>
  formulations.map((formulation, i) => ({ formulation, strengthAgreement: "agrees", score: 100 - i, related: true }));

const ids = (matches: CatalogMatch[]) => matches.map((m) => m.formulation.id);

const ibuprofen200 = (perUnit = "tablet") => [ing("Ibuprofen", s(200, "mg", 1, perUnit), "ibuprofen")];
const apap = (amount: number, perUnit = "caplet") => ing("Acetaminophen", s(amount, "mg", 1, perUnit), "acetaminophen");

describe("distinctMatches (one choice per product)", () => {
  it("keeps an empty list empty", () => {
    expect(distinctMatches([])).toEqual([]);
  });

  it("collapses store brands of the same product, keeping the best-ranked row and the rank order", () => {
    const matches = ranked(
      row("a", "Ibuprofen", "tablet", ibuprofen200(), "Walgreens"),
      row("b", "Advil", "tablet", ibuprofen200(), "Haleon"),
      row("c", "IBUPROFEN", "tablet", ibuprofen200(), "CVS"),
      row("d", "ibuprofen", "tablet", ibuprofen200(), "Target"),
      row("e", "Advil", "tablet", ibuprofen200(), "Haleon"),
    );
    expect(ids(distinctMatches(matches))).toEqual(["a", "b"]);
  });

  it("ignores case, punctuation, word order and form words in the brand name", () => {
    const matches = ranked(
      row("a", "Advil Liqui-Gels", "capsule", ibuprofen200("capsule")),
      row("b", "Advil", "capsule", ibuprofen200("capsule")),
      row("c", "ADVIL Liquigels", "capsule", ibuprofen200("capsule")),
      row("d", "Advil Liquid Gels", "capsule", ibuprofen200("capsule")),
      row("e", "Tylenol Extra Strength (caplets)", "caplet", [apap(500)]),
      row("f", "TYLENOL Extra Strength Caplets", "caplet", [apap(500)]),
      row("g", "Extra Strength TYLENOL", "caplet", [apap(500)]),
      row("h", "Children's Tylenol Oral Suspension", "liquid", [ing("Acetaminophen", s(160, "mg", 5, "mL"))]),
      row("i", "Childrens TYLENOL", "liquid", [ing("Acetaminophen", s(160, "mg", 5, "mL"))]),
    );
    expect(ids(distinctMatches(matches))).toEqual(["a", "e", "h"]);
  });

  it("keeps different versions of a brand apart: Regular, Extra Strength, PM, 8 HR, Children's", () => {
    const matches = ranked(
      row("regular", "Tylenol Regular Strength", "caplet", [apap(325)]),
      row("extra", "Tylenol Extra Strength", "caplet", [apap(500)]),
      row("pm", "Tylenol PM Extra Strength", "caplet", [apap(500), ing("Diphenhydramine HCl", s(25, "mg", 1, "caplet"))]),
      row("8hr", "Tylenol 8 HR", "extended-release tablet", [apap(650, "extended-release tablet")]),
      row("kids", "Children's Tylenol", "liquid", [ing("Acetaminophen", s(160, "mg", 5, "mL"))]),
    );
    expect(ids(distinctMatches(matches))).toEqual(["regular", "extra", "pm", "8hr", "kids"]);
  });

  it("keeps the same brand apart when the dosage form differs", () => {
    const matches = ranked(
      row("caplet", "TYLENOL Extra Strength", "caplet", [apap(500)]),
      row("gelcap", "TYLENOL Extra Strength", "gelcap", [apap(500, "gelcap")]),
      row("tablet", "TYLENOL Extra Strength", "tablet", [apap(500, "tablet")]),
    );
    expect(ids(distinctMatches(matches))).toEqual(["caplet", "gelcap", "tablet"]);
  });

  it("keeps the same brand apart when a strength or the ingredient set differs", () => {
    const matches = ranked(
      row("a", "Pain Relief", "caplet", [apap(500)]),
      row("b", "Pain Relief", "caplet", [apap(325)]),
      row("c", "Pain Relief", "caplet", [apap(500), ing("Caffeine", s(65, "mg", 1, "caplet"))]),
      row("d", "Pain Relief", "liquid", [ing("Acetaminophen", s(160, "mg", 5, "mL"))]),
      row("e", "Pain Relief", "liquid", [ing("Acetaminophen", s(500, "mg", 15, "mL"))]),
    );
    expect(ids(distinctMatches(matches))).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("compares ingredients by their normalized name and strengths by value", () => {
    const matches = ranked(
      row("a", "Tylenol PM", "caplet", [apap(500), ing("Diphenhydramine Hydrochloride", s(25, "mg", 1, "caplet"))]),
      // Same ingredients written differently, listed in another order, the strength in grams.
      row("b", "TYLENOL PM", "caplet", [ing("Diphenhydramine HCl", s(25, "mg", 1, "caplet")), ing("Acetaminophen", s(0.5, "g", 1, "caplet"))]),
      // 160 mg per 5 mL is 32 mg per mL.
      row("c", "Infants Tylenol", "liquid", [ing("Acetaminophen", s(160, "mg", 5, "mL"))]),
      row("d", "Infants' TYLENOL", "liquid", [ing("Acetaminophen", s(32, "mg", 1, "mL"))]),
    );
    expect(ids(distinctMatches(matches))).toEqual(["a", "c"]);
  });

  it("compares strengths in other units by unit and value", () => {
    const matches = ranked(
      row("a", "Vitamin D3", "softgel", [ing("Cholecalciferol", s(1000, "unit", 1, "softgel"))]),
      row("b", "Vitamin D3", "softgel", [ing("Cholecalciferol", s(1000, "unit", null, null))]),
      row("c", "Vitamin D3", "softgel", [ing("Cholecalciferol", s(1000, "mcg", 1, "softgel"))]),
      row("d", "Mouthwash", "liquid", [ing("Fluoride", s(1, "mg", 1, "L"))]),
      row("e", "Mouthwash", "liquid", [ing("Fluoride", s(0.001, "mg", 1, "mL"))]),
    );
    expect(ids(distinctMatches(matches))).toEqual(["a", "c", "d"]);
  });
});
