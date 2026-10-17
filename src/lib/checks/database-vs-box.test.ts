import { describe, expect, it } from "vitest";
import {
  calmoraA,
  cantTell,
  edited,
  input,
  makeEntry,
  mgPer,
  NYQUIL_ID,
  nyquilBarcode,
  nyquilBarcodeNoPhoto,
  nyquilBarcodePhotoDiffers,
} from "./__fixtures__/entries";
import { checkDatabaseVsBox } from "./database-vs-box";

describe("database vs box", () => {
  it("finds a confirmed photo strength that differs from the catalog label", () => {
    const run = checkDatabaseVsBox(input(nyquilBarcodePhotoDiffers));
    expect(run.status).toBe("finding");
    const f = run.findings[0];
    expect(f.id).toBe("database_vs_box:e-nyquil-differs:photo");
    expect(f.detail).toContain("325 mg per caplet");
    expect(f.detail).toContain("500 mg per caplet");
    expect(f.evidence.map((e) => e.evidence.kind)).toEqual(["database", "crop"]);
    expect(f.pharmacistQuestion).toContain("NyQuil Cold & Flu Nighttime Relief");
  });

  it("says when the box value was typed by the user", () => {
    const crop = { kind: "crop" as const, sourceDocumentId: "d", bbox: { x: 0, y: 0, w: 1, h: 1 } };
    const e = makeEntry({
      id: "e-nyq-typed",
      name: "NyQuil Cold & Flu Nighttime Relief",
      form: "caplet",
      ingredients: [{ name: "Acetaminophen", strength: edited(null, mgPer(500, 1, "caplet"), crop) }],
      doc: { kind: "drug_facts_photo" },
      inputMethod: "barcode",
      formulationId: NYQUIL_ID,
    });
    const f = checkDatabaseVsBox(input(e)).findings[0];
    expect(f.detail).toContain("you entered Acetaminophen 500 mg per caplet for the Drug Facts photo");
    expect(f.detail).not.toContain("photo you confirmed shows");
    expect(f.pharmacistQuestion).toContain("I entered Acetaminophen 500 mg per caplet from the box");
    expect(f.pharmacistQuestion).not.toContain("the box says Acetaminophen");
  });

  it("is no_finding when the photo matches the catalog", () => {
    const run = checkDatabaseVsBox(input(nyquilBarcode));
    expect(run.status).toBe("no_finding");
    expect(run.summary).toBe("No differences between the database label and the box found in confirmed fields");
  });

  it("is unresolved when there is only database evidence", () => {
    const run = checkDatabaseVsBox(input(nyquilBarcodeNoPhoto));
    expect(run.status).toBe("unresolved");
    expect(run.reasons).toEqual(["No Drug Facts photo to compare for NyQuil Cold & Flu Nighttime Relief"]);
  });

  it("is unresolved when the photo strength couldn't be read", () => {
    const crop = { kind: "crop" as const, sourceDocumentId: "d", bbox: { x: 0, y: 0, w: 1, h: 1 } };
    const e = makeEntry({
      id: "e-nyq-cant",
      name: "NyQuil Cold & Flu Nighttime Relief",
      form: "caplet",
      ingredients: [{ name: "Acetaminophen", strength: cantTell(mgPer(325, 1, "caplet"), crop) }],
      doc: { kind: "drug_facts_photo" },
      inputMethod: "barcode",
      formulationId: NYQUIL_ID,
    });
    const run = checkDatabaseVsBox(input(e));
    expect(run.status).toBe("unresolved");
    expect(run.reasons).toEqual(["Strength unreadable on Drug Facts photo (NyQuil Cold & Flu Nighttime Relief)"]);
  });

  it("reports an ingredient on the box that the catalog label doesn't list", () => {
    const e = makeEntry({
      id: "e-nyq-extra",
      name: "NyQuil Cold & Flu Nighttime Relief",
      form: "caplet",
      ingredients: [
        { name: "Acetaminophen", strength: mgPer(325, 1, "caplet") },
        { name: "Phenylephrine HCl", strength: mgPer(5, 1, "caplet") },
      ],
      doc: { kind: "drug_facts_photo" },
      inputMethod: "barcode",
      formulationId: NYQUIL_ID,
    });
    const f = checkDatabaseVsBox(input(e)).findings[0];
    expect(f.detail).toContain("Phenylephrine HCl");
  });

  it("is not applicable without barcode entries", () => {
    expect(checkDatabaseVsBox(input(calmoraA)).status).toBe("not_applicable");
  });
});
