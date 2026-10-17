import { describe, expect, it } from "vitest";
import {
  calmoraA,
  described,
  discharge,
  input,
  nyquilBarcode,
  prescription,
  prescriptionDosePending,
  prescriptionMgDose,
  prescriptionMlDose,
  prescriptionStrengthUnknown,
  prescriptionTyped,
  prescriptionUnclearUnit,
} from "./__fixtures__/entries";
import { checkUnits } from "./units";

describe("units", () => {
  it("finds a teaspoon dose against a strength printed per mL", () => {
    const run = checkUnits(input(prescription));
    expect(run.status).toBe("finding");
    const f = run.findings[0];
    expect(f.id).toBe("units:e-rx:volume_units");
    expect(f.title).toMatch(/^The amount and strength use different units: /);
    expect(f.detail).toContain("2 tsp");
    expect(f.detail).toContain("160 mg per 5 mL");
    expect(f.evidence.map((e) => e.field)).toEqual(["doseAsWritten", "ingredients[0].strength"]);
    expect(f.evidence[0].documentDate).toBe("2026-10-16");
    // never converts teaspoons to mL
    expect(JSON.stringify(f)).not.toMatch(/10 mL|= ?\d/);
  });

  it("attributes label values to the label", () => {
    const f = checkUnits(input(prescription)).findings[0];
    expect(f.detail).toBe(
      "Prescription label: The dose is written as 2 tsp, but the strength is printed as 160 mg per 5 mL. These units don't line up.",
    );
    expect(f.pharmacistQuestion).toBe(
      "The prescription label says to give 2 tsp, but the strength is listed as 160 mg per 5 mL. How should I measure this, and with what?",
    );
  });

  it("says when the user typed the dose and strength", () => {
    const f = checkUnits(input(prescriptionTyped)).findings[0];
    expect(f.detail).toBe(
      "Prescription label: You entered the dose as 2 tsp, but you entered the strength as 160 mg per 5 mL. These units don't line up.",
    );
    expect(f.pharmacistQuestion).toBe(
      "I entered the dose for the prescription label as 2 tsp, but I entered the strength as 160 mg per 5 mL. How should I measure this, and with what?",
    );
  });

  it("never calls a description printed", () => {
    const f = checkUnits(input(described)).findings[0];
    expect(f.detail).toBe(
      "Your description: The dose is given as 2 tsp, but the strength is given as 200 mg per 5 mL. These units don't line up.",
    );
    expect(f.pharmacistQuestion).toBe(
      "My description says to give 2 tsp, but the strength is listed as 200 mg per 5 mL. How should I measure this, and with what?",
    );
    expect(`${f.detail} ${f.pharmacistQuestion}`).not.toMatch(/label|printed|bottle/i);
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
