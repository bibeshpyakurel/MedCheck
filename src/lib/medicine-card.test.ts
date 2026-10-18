import { describe, expect, it } from "vitest";
import type { Formulation, LabelSections } from "@/lib/domain/schema";
import { cardSections } from "./medicine-card";

function formulation(overrides: Partial<Formulation> = {}): Formulation {
  return {
    id: "f-1",
    slug: "otc-abc",
    brandName: "Advil Liqui-Gels",
    genericName: "Ibuprofen",
    dosageForm: "capsule",
    isFictional: false,
    ndcPackages: [],
    activeIngredients: [
      { name: "Ibuprofen", normalized: "ibuprofen", strength: { amount: 200, unit: "mg", perAmount: 1, perUnit: "capsule" } },
    ],
    directionsText: "do not take more than directed",
    max24hText: "do not exceed 6 capsules in 24 hours",
    warningsQuotes: ["Stomach bleeding warning: This product contains an NSAID"],
    dosageTableHtml: null,
    source: "openfda",
    openfdaSetId: "abc",
    labelEffectiveDate: "2025-03-01",
    labelerName: "Haleon US Holdings LLC",
    labelSections: {},
    sourceLinks: [],
    reviewed: false,
    ...overrides,
  };
}

const FULL: Required<LabelSections> = {
  uses: ["temporarily relieves minor aches and pains due to: headache", "temporarily reduces fever"],
  purpose: ["Pain reliever/fever reducer"],
  directions: ["do not take more than directed", "adults and children 12 years and over: take 1 capsule every 4 to 6 hours"],
  do_not_use: ["if you have ever had an allergic reaction to any other pain reliever/fever reducer"],
  ask_doctor: ["stomach bleeding warning applies to you"],
  ask_doctor_or_pharmacist: ["under a doctor's care for any serious condition"],
  when_using: ["take with food or milk if stomach upset occurs"],
  stop_use: ["you experience any of the following signs of stomach bleeding"],
  pregnancy_or_breast_feeding: ["ask a health professional before use"],
  warnings: ["Allergy alert: Ibuprofen may cause a severe allergic reaction"],
  keep_out_of_reach: ["In case of overdose, get medical help or contact a Poison Control Center right away."],
  inactive_ingredients: ["FD&C green no. 3, gelatin, light mineral oil"],
  storage: ["store at 20-25°C (68-77°F)", "avoid excessive heat above 40°C (104°F)"],
  other_information: ["each tablet contains: sodium 20 mg"],
  questions: ["call 1-800-88-ADVIL"],
};

describe("cardSections", () => {
  it("lists every section in card order with plain-language headings", () => {
    const sections = cardSections(formulation({ labelSections: FULL }));
    expect(sections.map((s) => [s.key, s.heading])).toEqual([
      ["uses", "What it's for"],
      ["active_ingredients", "Active ingredients"],
      ["directions", "How to take it"],
      ["max_24h", "24-hour limit"],
      ["do_not_use", "Don't use if"],
      ["ask_doctor", "Ask a doctor first if"],
      ["ask_doctor_or_pharmacist", "Taking other medicines?"],
      ["when_using", "While using it"],
      ["stop_use", "Stop and ask a doctor if"],
      ["pregnancy_or_breast_feeding", "Pregnant or breastfeeding"],
      ["warnings", "Other warnings"],
      ["keep_out_of_reach", "Keep out of reach of children"],
      ["inactive_ingredients", "Inactive ingredients (allergies)"],
      ["storage", "Storage"],
      ["other_information", "Other information"],
      ["questions", "Questions about this product"],
    ]);
  });

  it("passes the label's bullets through unchanged", () => {
    const sections = cardSections(formulation({ labelSections: FULL }));
    const byKey = Object.fromEntries(sections.map((s) => [s.key, s.bullets]));
    for (const key of Object.keys(FULL) as (keyof LabelSections)[]) {
      if (key === "purpose") continue; // folded into the active-ingredients section
      expect(byKey[key]).toEqual(FULL[key]);
    }
    expect(byKey.max_24h).toEqual(["do not exceed 6 capsules in 24 hours"]);
  });

  it("skips sections the label doesn't have, and empty or blank ones", () => {
    const sections = cardSections(
      formulation({
        max24hText: null,
        labelSections: { uses: ["temporarily reduces fever"], storage: [], when_using: ["  "] },
      }),
    );
    expect(sections.map((s) => s.key)).toEqual(["uses", "active_ingredients", "directions"]);
  });

  it("builds active-ingredient lines from the ingredients and their strengths, then the purpose bullets", () => {
    const f = formulation({
      activeIngredients: [
        { name: "Acetaminophen", normalized: "acetaminophen", strength: { amount: 325, unit: "mg", perAmount: 15, perUnit: "mL" } },
        { name: "Doxylamine succinate", normalized: "doxylamine", strength: { amount: 6.25, unit: "mg", perAmount: 15, perUnit: "mL" } },
      ],
      labelSections: { purpose: ["Pain reliever/fever reducer", "Antihistamine"] },
    });
    const active = cardSections(f).find((s) => s.key === "active_ingredients");
    expect(active?.bullets).toEqual([
      "Acetaminophen 325 mg per 15 mL",
      "Doxylamine succinate 6.25 mg per 15 mL",
      "Pain reliever/fever reducer",
      "Antihistamine",
    ]);
  });

  it("shows ingredient lines alone when the label has no purpose, and nothing when there are no ingredients", () => {
    const one = cardSections(formulation()).find((s) => s.key === "active_ingredients");
    expect(one?.bullets).toEqual(["Ibuprofen 200 mg per capsule"]);
    const none = cardSections(formulation({ activeIngredients: [] }));
    expect(none.some((s) => s.key === "active_ingredients")).toBe(false);
  });

  it("falls back to directionsText and warningsQuotes for rows without labelSections", () => {
    const sections = cardSections(formulation({ labelSections: {} }));
    expect(sections.map((s) => [s.key, s.bullets])).toEqual([
      ["active_ingredients", ["Ibuprofen 200 mg per capsule"]],
      ["directions", ["do not take more than directed"]],
      ["max_24h", ["do not exceed 6 capsules in 24 hours"]],
      ["warnings", ["Stomach bleeding warning: This product contains an NSAID"]],
    ]);
  });

  it("doesn't repeat warningsQuotes when the label has its own sections", () => {
    const sections = cardSections(formulation({ labelSections: { do_not_use: ["if you are allergic to ibuprofen"] } }));
    expect(sections.some((s) => s.key === "warnings")).toBe(false);
  });

  it("prefers the directions section over directionsText", () => {
    const sections = cardSections(formulation({ labelSections: { directions: ["shake well before using"] } }));
    expect(sections.find((s) => s.key === "directions")?.bullets).toEqual(["shake well before using"]);
  });

  it("keeps How to take it when the only directions are the dosing table", () => {
    const sections = cardSections(
      formulation({ directionsText: null, dosageTableHtml: "<table><tr><td>adults</td></tr></table>" }),
    );
    expect(sections.find((s) => s.key === "directions")).toEqual({ key: "directions", heading: "How to take it", bullets: [] });
  });

  it("returns no sections for a bare row", () => {
    const sections = cardSections(
      formulation({ activeIngredients: [], directionsText: null, max24hText: null, warningsQuotes: [] }),
    );
    expect(sections).toEqual([]);
  });
});
