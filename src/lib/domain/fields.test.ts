import { describe, expect, it } from "vitest";
import {
  confirmedFieldsFromFormulation,
  emptyEntryFields,
  formatStrength,
  isFullyReviewed,
  isUsable,
  suggestedField,
} from "./fields";
import type { Field, Formulation } from "./schema";

describe("formatStrength", () => {
  it("formats liquid concentration", () => {
    expect(formatStrength({ amount: 100, unit: "mg", perAmount: 5, perUnit: "mL" })).toBe("100 mg per 5 mL");
  });
  it("formats per-unit solids", () => {
    expect(formatStrength({ amount: 325, unit: "mg", perAmount: 1, perUnit: "caplet" })).toBe("325 mg per caplet");
  });
  it("formats a bare amount", () => {
    expect(formatStrength({ amount: 6.25, unit: "mg", perAmount: null, perUnit: null })).toBe("6.25 mg");
  });
});

describe("field states", () => {
  it("a suggestion is pending and not usable until confirmed", () => {
    const f = suggestedField("Acetaminophen", { kind: "none" });
    expect(f.state).toBe("pending");
    expect(isUsable(f)).toBe(false);
    expect(isUsable({ ...f, state: "confirmed" })).toBe(true);
  });
  it("a missing suggestion starts unknown", () => {
    expect(suggestedField(null, { kind: "none" }).state).toBe("unknown");
  });
  it("unknown is never usable", () => {
    expect(isUsable({ aiValue: "x", value: "x", state: "unknown", evidence: { kind: "none" } })).toBe(false);
  });
  it("isFullyReviewed is false while anything is pending", () => {
    const fields = emptyEntryFields();
    expect(isFullyReviewed(fields)).toBe(true);
    fields.productName = suggestedField("Calmora", { kind: "none" });
    expect(isFullyReviewed(fields)).toBe(false);
  });
});

describe("confirmedFieldsFromFormulation (the one-tap catalog confirm)", () => {
  const label: Formulation = {
    id: "f-1",
    slug: "tylenol-extra-strength-500mg-caplet",
    brandName: "Tylenol Extra Strength (caplets)",
    genericName: "Acetaminophen",
    dosageForm: "caplet",
    isFictional: false,
    ndcPackages: [],
    activeIngredients: [
      { name: "Acetaminophen", normalized: "acetaminophen", strength: { amount: 500, unit: "mg", perAmount: 1, perUnit: "caplet" } },
    ],
    directionsText: "adults and children 12 years and over: take 2 caplets every 6 hours while symptoms last",
    max24hText: null,
    warningsQuotes: [],
    dosageTableHtml: null,
    source: "openfda",
    openfdaSetId: null,
    labelEffectiveDate: null,
    labelerName: null,
    labelSections: {},
    sourceLinks: [],
    reviewed: true,
  };
  const fields = confirmedFieldsFromFormulation(label);

  it("confirms every value the label has, with the label's value", () => {
    expect(fields.productName).toEqual({
      aiValue: "Tylenol Extra Strength (caplets)",
      value: "Tylenol Extra Strength (caplets)",
      state: "confirmed",
      evidence: { kind: "database", formulationId: "f-1", text: "Tylenol Extra Strength (caplets)" },
    });
    expect(fields.dosageForm).toMatchObject({ value: "caplet", state: "confirmed" });
    expect(fields.instructions).toMatchObject({ value: label.directionsText, state: "confirmed" });
    expect(fields.ingredients).toEqual([
      {
        name: { aiValue: "Acetaminophen", value: "Acetaminophen", state: "confirmed", evidence: { kind: "database", formulationId: "f-1", text: "Acetaminophen" } },
        strength: {
          aiValue: label.activeIngredients[0].strength,
          value: label.activeIngredients[0].strength,
          state: "confirmed",
          evidence: { kind: "database", formulationId: "f-1", text: "500 mg per caplet" },
        },
      },
    ]);
  });

  it("leaves what the label doesn't say unknown, never confirmed", () => {
    expect(fields.max24h).toMatchObject({ value: null, state: "unknown" });
    // The catalog never carries a dose: it stays unknown with no evidence.
    expect(fields.doseAsWritten).toEqual({ aiValue: null, value: null, state: "unknown", evidence: { kind: "none" } });
  });

  it("leaves nothing pending, so the entry can be confirmed", () => {
    expect(isFullyReviewed(fields)).toBe(true);
    const all: Field<unknown>[] = [fields.productName, fields.dosageForm, fields.instructions, fields.doseAsWritten, fields.max24h];
    expect(all.every((f) => f.state === "confirmed" || f.state === "unknown")).toBe(true);
  });

  it("every confirmed value points at the label", () => {
    const confirmed = [fields.productName, fields.dosageForm, fields.instructions, ...fields.ingredients.flatMap((i) => [i.name, i.strength])];
    for (const f of confirmed) expect(f.evidence).toMatchObject({ kind: "database", formulationId: "f-1" });
  });
});
