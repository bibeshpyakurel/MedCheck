import { describe, expect, it } from "vitest";
import {
  calmoraA,
  calmoraAAgain,
  calmoraB,
  ibuprofen,
  input,
  nyquilBarcode,
  prescription,
  prescriptionStrengthPending,
  prescriptionStrengthUnknown,
} from "./__fixtures__/entries";
import { checkConcentration } from "./concentration";

describe("concentration", () => {
  it("finds Bottle A vs Bottle B, stating both strengths as printed", () => {
    const run = checkConcentration(input(calmoraA, calmoraB));
    expect(run.status).toBe("finding");
    const f = run.findings[0];
    expect(f.id).toBe("concentration:e-calmora-a,e-calmora-b:acetaminophen");
    const text = `${f.title} ${f.detail} ${f.pharmacistQuestion}`;
    expect(text).toContain("100 mg per 5 mL");
    expect(text).toContain("200 mg per 5 mL");
    expect(f.detail).toContain("same volume");
    expect(f.evidence.map((e) => e.text)).toEqual(["100 mg per 5 mL", "200 mg per 5 mL"]);
  });

  it("never suggests or computes a volume or a per-mL figure", () => {
    const text = JSON.stringify(checkConcentration(input(calmoraA, calmoraB)));
    // only the volumes printed on the labels ("per 5 mL") may appear
    const volumes = text.match(/\d+(\.\d+)?\s*mL/g) ?? [];
    expect(volumes.every((v) => v === "5 mL")).toBe(true);
    expect(text).not.toMatch(/mg\/mL|per mL|20 mg|40 mg|safe/i);
  });

  it("is no_finding when liquids have the same strength", () => {
    const run = checkConcentration(input(calmoraA, calmoraAAgain));
    expect(run.status).toBe("no_finding");
    expect(run.summary).toBe("No differing liquid strengths found in confirmed fields");
  });

  it("is unresolved when a liquid's strength is unknown, naming the product", () => {
    const run = checkConcentration(input(calmoraA, prescriptionStrengthUnknown));
    expect(run.status).toBe("unresolved");
    expect(run.reasons).toEqual(["Strength unreadable on Prescription label (Acetaminophen oral suspension)"]);
  });

  it("is unresolved when a liquid's strength is still pending", () => {
    const run = checkConcentration(input(calmoraA, prescriptionStrengthPending));
    expect(run.status).toBe("unresolved");
    expect(run.reasons[0]).toContain("not confirmed yet");
  });

  it("still reports a finding alongside an unresolved entry", () => {
    const run = checkConcentration(input(calmoraA, calmoraB, prescriptionStrengthUnknown));
    expect(run.status).toBe("finding");
    expect(run.reasons).toHaveLength(1);
  });

  it("ignores solids and liquids with different ingredients", () => {
    expect(checkConcentration(input(calmoraA, nyquilBarcode)).status).toBe("not_applicable");
    expect(checkConcentration(input(calmoraA, ibuprofen)).status).toBe("not_applicable");
  });

  it("lists three distinct strengths in one finding", () => {
    const run = checkConcentration(input(calmoraA, calmoraB, prescription));
    expect(run.findings).toHaveLength(1);
    expect(run.findings[0].pharmacistQuestion).toContain("160 mg per 5 mL");
  });
});
