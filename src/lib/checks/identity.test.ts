import { describe, expect, it } from "vitest";
import {
  calmoraA,
  calmoraAAgain,
  calmoraB,
  discharge,
  makeEntry,
  mgPer,
  NYQUIL_ID,
  nyquilBarcode,
  nyquilBarcodeNoPhoto,
  prescription,
  prescriptionStrengthUnknown,
} from "./__fixtures__/entries";
import { groupByProduct, productIdentity } from "./identity";

describe("productIdentity", () => {
  it("uses the formulation id when there is one", () => {
    expect(productIdentity(nyquilBarcode)).toBe(`formulation:${NYQUIL_ID}`);
    expect(productIdentity(nyquilBarcode)).toBe(productIdentity(nyquilBarcodeNoPhoto));
  });

  it("otherwise uses normalized name + strength + form", () => {
    const b = makeEntry({
      id: "x1",
      name: "  calmora  extra fever relief (Bottle B) ",
      form: "Liquid",
      ingredients: [{ name: "APAP", strength: mgPer(40, 1, "mL") }],
    });
    expect(productIdentity(b)).not.toBeNull();
    expect(productIdentity(b)).toBe(productIdentity(calmoraB));
    expect(productIdentity(prescription)).not.toBe(productIdentity(discharge));
  });

  it("is null when a needed field is not usable", () => {
    expect(productIdentity(prescriptionStrengthUnknown)).toBeNull();
  });
});

describe("groupByProduct", () => {
  it("groups repeats and keeps distinct products apart", () => {
    const groups = groupByProduct([calmoraA, calmoraB, calmoraAAgain, nyquilBarcode]);
    expect(groups.map((g) => g.map((e) => e.id))).toEqual([
      ["e-calmora-a", "e-calmora-a-2"],
      ["e-calmora-b"],
      ["e-nyquil"],
    ]);
  });

  it("matches a catalog entry and a photo entry with the same name, strength and form", () => {
    const photo = makeEntry({
      id: "photo-a",
      name: "Calmora Fever Relief (Bottle A)",
      form: "liquid",
      ingredients: [{ name: "Acetaminophen", strength: mgPer(100, 5, "mL") }],
      doc: { kind: "otc_package" },
    });
    expect(groupByProduct([calmoraA, photo])).toHaveLength(1);
  });

  it("keeps entries without an identity on their own", () => {
    expect(groupByProduct([prescriptionStrengthUnknown, prescription])).toHaveLength(2);
  });
});
