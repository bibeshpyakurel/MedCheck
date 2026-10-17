import { describe, expect, it } from "vitest";
import {
  calmoraA,
  mgPer,
  nyquilBarcode,
  prescription,
  prescriptionStrengthPending,
  prescriptionStrengthUnknown,
} from "./__fixtures__/entries";
import { formFamily, joinList, mgPerMl, sourceLabel, sourcePhrase, strengthsMatch, unusableReason } from "./shared";

describe("mgPerMl", () => {
  it("converts per-volume strengths to mg per mL", () => {
    expect(mgPerMl(mgPer(100, 5, "mL"))).toBe(20);
    expect(mgPerMl(mgPer(160, 5, "ml"))).toBe(32);
    expect(mgPerMl({ amount: 1, unit: "g", perAmount: 1, perUnit: "L" })).toBe(1);
    expect(mgPerMl(mgPer(80, null, "mL"))).toBe(80);
  });
  it("returns null for solids and non-mass amounts", () => {
    expect(mgPerMl(mgPer(325, 1, "caplet"))).toBeNull();
    expect(mgPerMl(mgPer(500, null, null))).toBeNull();
    expect(mgPerMl({ amount: 5, unit: "mL", perAmount: 5, perUnit: "mL" })).toBeNull();
  });
});

describe("strengthsMatch", () => {
  it("treats the same mg per mL as matching even when printed differently", () => {
    expect(strengthsMatch(mgPer(160, 5, "mL"), mgPer(32, 1, "mL"))).toBe(true);
    expect(strengthsMatch(mgPer(100, 5, "mL"), mgPer(200, 5, "mL"))).toBe(false);
    expect(strengthsMatch(mgPer(325, 1, "caplet"), mgPer(325, null, "Caplet"))).toBe(true);
    expect(strengthsMatch(mgPer(325, 1, "caplet"), mgPer(500, 1, "caplet"))).toBe(false);
  });
});

describe("formFamily", () => {
  it("classifies liquids and solids from the form or the strength", () => {
    expect(formFamily(calmoraA)).toBe("liquid");
    expect(formFamily(prescription)).toBe("liquid");
    expect(formFamily(nyquilBarcode)).toBe("solid");
  });
});

describe("reasons", () => {
  it("names the field, the document and the product", () => {
    const field = prescriptionStrengthUnknown.fields.ingredients[0].strength;
    expect(unusableReason(prescriptionStrengthUnknown, "Strength", field)).toBe(
      "Strength unreadable on Prescription label (Acetaminophen oral suspension)",
    );
    const p = prescriptionStrengthPending.fields.ingredients[0].strength;
    expect(unusableReason(prescriptionStrengthPending, "Strength", p)).toBe(
      "Strength not confirmed yet on Prescription label (Acetaminophen oral suspension)",
    );
  });
  it("labels sources", () => {
    expect(sourceLabel(prescription)).toBe("Prescription label");
    expect(sourceLabel(nyquilBarcode)).toBe("Drug Facts photo");
  });
  it("calls packages, Drug Facts photos and catalog products 'the package', never 'the bottle'", () => {
    expect(sourcePhrase(nyquilBarcode)).toBe("the package label");
    expect(sourcePhrase(calmoraA)).toBe("the package label");
    expect(sourcePhrase(calmoraA, "entered")).toBe("the package");
    expect(sourcePhrase(prescription)).toBe("the prescription label");
  });
  it("joins lists in plain English", () => {
    expect(joinList(["a"])).toBe("a");
    expect(joinList(["a", "b"])).toBe("a and b");
    expect(joinList(["a", "b", "c"])).toBe("a, b and c");
  });
});
