import { describe, expect, it } from "vitest";
import {
  calmoraA,
  calmoraAFormulation,
  calmoraBCorrected,
  described,
  discharge,
  dischargeTyped,
  input,
  nyquilBarcodePhotoDiffers,
  nyquilFormulation,
} from "./__fixtures__/entries";
import { checkDatabaseVsBox } from "./database-vs-box";
import { checkConcentration } from "./concentration";
import { entrySourceHref, evidenceProvenance, fieldAt, officialLabelUrl } from "./evidence-source";
import { checkUnits } from "./units";

describe("fieldAt", () => {
  it("resolves the field paths findings use", () => {
    expect(fieldAt(calmoraA, "productName")).toBe(calmoraA.fields.productName);
    expect(fieldAt(calmoraA, "doseAsWritten")).toBe(calmoraA.fields.doseAsWritten);
    expect(fieldAt(calmoraA, "ingredients[0].strength")).toBe(calmoraA.fields.ingredients[0].strength);
    expect(fieldAt(calmoraA, "ingredients[0].name")).toBe(calmoraA.fields.ingredients[0].name);
    expect(fieldAt(calmoraA, "ingredients[3].name")).toBeNull();
    expect(fieldAt(calmoraA, "catalog.activeIngredients[0].strength")).toBeNull();
  });
});

describe("evidenceProvenance", () => {
  it("tells label values, typed values and descriptions apart", () => {
    const doc = checkConcentration(input(dischargeTyped, calmoraA)).findings[0];
    const byEntry = (id: string) => [dischargeTyped, calmoraA].find((e) => e.id === id);
    expect(doc.evidence.map((e) => evidenceProvenance(e, byEntry(e.entryId)))).toEqual(["entered", "label"]);

    const units = checkUnits(input(described)).findings[0];
    expect(units.evidence.map((e) => evidenceProvenance(e, described))).toEqual(["described", "described"]);

    // An AI suggestion the user corrected is theirs too.
    const corrected = checkConcentration(input(discharge, calmoraBCorrected)).findings[0];
    const both = (id: string) => [discharge, calmoraBCorrected].find((e) => e.id === id);
    expect(corrected.evidence.map((e) => evidenceProvenance(e, both(e.entryId)))).toEqual(["label", "entered"]);
  });

  it("treats catalog values as the label", () => {
    const f = checkDatabaseVsBox(input(nyquilBarcodePhotoDiffers)).findings[0];
    expect(evidenceProvenance(f.evidence[0], nyquilBarcodePhotoDiffers)).toBe("label");
  });

  it("falls back to the evidence when the entry isn't available", () => {
    const f = checkUnits(input(described)).findings[0];
    expect(evidenceProvenance(f.evidence[0], undefined)).toBe("described");
    const doc = checkConcentration(input(dischargeTyped, calmoraA)).findings[0];
    expect(evidenceProvenance(doc.evidence[1], undefined)).toBe("label");
  });
});

describe("source links", () => {
  it("links evidence to the entry's label view", () => {
    expect(entrySourceHref("p-1", "e-1")).toBe("/patients/p-1/entries/e-1");
  });

  it("links openFDA labels to DailyMed by set id, never fictional products", () => {
    expect(officialLabelUrl(nyquilFormulation)).toBe("https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=set-nyquil");
    expect(officialLabelUrl(calmoraAFormulation)).toBeNull();
    expect(officialLabelUrl({ ...nyquilFormulation, openfdaSetId: null })).toBeNull();
    expect(officialLabelUrl({ ...nyquilFormulation, isFictional: true })).toBeNull();
    expect(officialLabelUrl(undefined)).toBeNull();
  });

  it("encodes the set id", () => {
    expect(officialLabelUrl({ ...nyquilFormulation, openfdaSetId: "a b&c" })).toBe(
      "https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=a%20b%26c",
    );
  });
});
