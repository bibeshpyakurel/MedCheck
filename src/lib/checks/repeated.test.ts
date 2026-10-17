import { describe, expect, it } from "vitest";
import {
  calmoraA,
  calmoraAAgain,
  calmoraB,
  input,
  nyquilBarcode,
  nyquilBarcodeNoPhoto,
  prescription,
  prescriptionStrengthUnknown,
} from "./__fixtures__/entries";
import { checkRepeatedRecord } from "./repeated";

describe("repeated record", () => {
  it("reports the same product entered twice", () => {
    const run = checkRepeatedRecord(input(calmoraA, calmoraAAgain));
    expect(run.status).toBe("finding");
    const f = run.findings[0];
    expect(f.check).toBe("repeated_record");
    expect(f.id).toBe("repeated_record:e-calmora-a,e-calmora-a-2:product");
    expect(f.title).toBe("Calmora Fever Relief (Bottle A) is listed twice");
    expect(f.evidence).toHaveLength(2);
    expect(f.pharmacistQuestion).toContain("Calmora Fever Relief (Bottle A)");
  });

  it("matches two barcode scans of the same catalog label", () => {
    const run = checkRepeatedRecord(input(nyquilBarcode, nyquilBarcodeNoPhoto));
    expect(run.findings[0].entryIds).toEqual(["e-nyquil", "e-nyquil-nophoto"]);
  });

  it("is no_finding for distinct products", () => {
    const run = checkRepeatedRecord(input(calmoraA, calmoraB));
    expect(run.status).toBe("no_finding");
    expect(run.summary).toBe("No repeated medicines found in confirmed fields");
  });

  it("is unresolved when a product can't be identified", () => {
    const run = checkRepeatedRecord(input(prescription, prescriptionStrengthUnknown));
    expect(run.status).toBe("unresolved");
    expect(run.reasons).toEqual(["Strength unreadable on Prescription label (Acetaminophen oral suspension)"]);
  });

  it("is not applicable with fewer than two medicines", () => {
    expect(checkRepeatedRecord(input(calmoraA)).status).toBe("not_applicable");
  });
});
