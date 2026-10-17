import { describe, expect, it } from "vitest";
import {
  calmoraA,
  discharge,
  input,
  nyquilBarcode,
  prescription,
  prescriptionDosePending,
  prescriptionMgDose,
  prescriptionMlDose,
  prescriptionStrengthUnknown,
  prescriptionUnclearUnit,
} from "./__fixtures__/entries";
import { checkUnits } from "./units";

describe("units", () => {
  it("finds a teaspoon dose against a strength printed per mL", () => {
    const run = checkUnits(input(prescription));
    expect(run.status).toBe("finding");
    const f = run.findings[0];
    expect(f.id).toBe("units:e-rx:volume_units");
    expect(f.detail).toContain("2 tsp");
    expect(f.detail).toContain("160 mg per 5 mL");
    expect(f.evidence.map((e) => e.field)).toEqual(["doseAsWritten", "ingredients[0].strength"]);
    expect(f.evidence[0].documentDate).toBe("2026-10-16");
    // never converts teaspoons to mL
    expect(JSON.stringify(f)).not.toMatch(/10 mL|= ?\d/);
  });

  it("finds an mg dose for a liquid", () => {
    const f = checkUnits(input(prescriptionMgDose)).findings[0];
    expect(f.id).toBe("units:e-rx-mg:mass_dose");
    expect(f.detail).toContain("320 mg");
  });

  it("finds a dose with no measuring unit", () => {
    const f = checkUnits(input(prescriptionUnclearUnit)).findings[0];
    expect(f.id).toBe("units:e-rx-unclear:unclear_unit");
  });

  it("is no_finding when mL lines up with mL and caplets with caplets", () => {
    const run = checkUnits(input(prescriptionMlDose, discharge, nyquilBarcode));
    expect(run.status).toBe("no_finding");
    expect(run.summary).toBe("No unit mismatches found in confirmed fields");
  });

  it("is unresolved when the dose is pending or the strength unknown", () => {
    expect(checkUnits(input(prescriptionDosePending)).reasons).toEqual([
      "Dose not confirmed yet on Prescription label (Acetaminophen oral suspension)",
    ]);
    expect(checkUnits(input(prescriptionStrengthUnknown)).reasons).toEqual([
      "Strength unreadable on Prescription label (Acetaminophen oral suspension)",
    ]);
  });

  it("is not applicable when no dose is written (catalog labels)", () => {
    expect(checkUnits(input(calmoraA)).status).toBe("not_applicable");
  });
});
