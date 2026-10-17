import { describe, expect, it } from "vitest";
import {
  calmoraA,
  calmoraB,
  calmoraBCorrected,
  discharge,
  dischargeTyped,
  input,
  makeEntry,
  mgPer,
  nyquilBarcode,
  prescription,
  prescriptionMlDose,
  prescriptionStrengthUnknown,
  prescriptionTyped,
} from "./__fixtures__/entries";
import { checkDocumentVsBottle } from "./document-vs-bottle";

describe("document vs bottle", () => {
  it("finds the discharge list (160 mg per 5 mL) disagreeing with the bottle (100 mg per 5 mL)", () => {
    const run = checkDocumentVsBottle(input(discharge, calmoraA));
    expect(run.status).toBe("finding");
    expect(run.findings).toHaveLength(1);
    const f = run.findings[0];
    expect(f.id).toBe("document_vs_bottle:e-calmora-a,e-discharge:acetaminophen:strength");
    expect(f.pharmacistQuestion).toBe(
      "The discharge list says 160 mg per 5 mL but the bottle label says 100 mg per 5 mL. Which strength should I be using, and how much?",
    );
    expect(f.detail).toContain("Discharge list (2026-10-16)");
    expect(f.detail).toContain("MedCheck doesn't decide which is right");
    expect(f.evidence.map((e) => [e.documentKind, e.documentDate])).toEqual([
      ["discharge_list", "2026-10-16"],
      ["otc_package", null],
    ]);
  });

  it("lists every document kind and date", () => {
    const f = checkDocumentVsBottle(input(prescriptionMlDose, discharge, calmoraA)).findings[0];
    expect(f.evidence.map((e) => e.documentKind)).toEqual(["prescription_label", "discharge_list", "otc_package"]);
    expect(f.detail).toContain("Prescription label (2026-10-16)");
  });

  it("reports differing doses as written, without converting", () => {
    const run = checkDocumentVsBottle(input(prescription, discharge));
    expect(run.findings.map((f) => f.id)).toEqual([
      "document_vs_bottle:e-discharge,e-rx:acetaminophen:dose",
    ]);
    expect(run.findings[0].pharmacistQuestion).toBe(
      "The prescription label says 2 tsp but the discharge list says 10 mL. How much should I give, and how should I measure it?",
    );
  });

  it("says which values the user typed instead of attributing them to the document", () => {
    const f = checkDocumentVsBottle(input(dischargeTyped, calmoraA)).findings[0];
    expect(f.pharmacistQuestion).toBe(
      "I entered 160 mg per 5 mL for the discharge list but the bottle label says 100 mg per 5 mL. Which strength should I be using, and how much?",
    );
    expect(f.detail).toContain("Discharge list (2026-10-16): you entered 160 mg per 5 mL");
    expect(f.detail).toContain("Package label (Calmora Fever Relief (Bottle A)) says 100 mg per 5 mL");
    expect(f.detail).not.toContain("Discharge list (2026-10-16) says");

    const corrected = checkDocumentVsBottle(input(discharge, calmoraBCorrected)).findings[0];
    expect(corrected.pharmacistQuestion).toBe(
      "The discharge list says 160 mg per 5 mL but I entered 200 mg per 5 mL for the bottle. Which strength should I be using, and how much?",
    );

    const dose = checkDocumentVsBottle(input(prescriptionTyped, dischargeTyped)).findings[0];
    expect(dose.pharmacistQuestion).toBe(
      "I entered 2 tsp for the prescription label but I entered 10 mL for the discharge list. How much should I give, and how should I measure it?",
    );
  });

  it("is no_finding when documents agree", () => {
    const run = checkDocumentVsBottle(input(prescriptionMlDose, discharge));
    expect(run.status).toBe("no_finding");
    expect(run.summary).toBe("No disagreements between documents found in confirmed fields");
  });

  it("does not compare two bottles (that's the concentration check) or a caplet with a liquid", () => {
    expect(checkDocumentVsBottle(input(calmoraA, calmoraB)).status).toBe("not_applicable");
    expect(checkDocumentVsBottle(input(nyquilBarcode, discharge)).status).toBe("not_applicable");
  });

  it("is unresolved when a document's strength is unknown", () => {
    const run = checkDocumentVsBottle(input(prescriptionStrengthUnknown, calmoraA));
    expect(run.status).toBe("unresolved");
    expect(run.reasons).toEqual(["Strength unreadable on Prescription label (Acetaminophen oral suspension)"]);
  });

  it("treats a barcode entry with no photo as the bottle", () => {
    const bottle = makeEntry({
      id: "pick-b",
      name: "Calmora Extra Fever Relief (Bottle B)",
      form: "liquid",
      ingredients: [{ name: "Acetaminophen", strength: mgPer(200, 5, "mL") }],
      inputMethod: "picker",
      formulationId: "f-calmora-b",
    });
    const f = checkDocumentVsBottle(input(discharge, bottle)).findings[0];
    expect(f.pharmacistQuestion).toContain("the bottle label says 200 mg per 5 mL");
  });
});
