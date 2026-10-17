import { describe, expect, it } from "vitest";
import { CHECK_IDS } from "@/lib/domain/schema";
import {
  calmoraA,
  calmoraADraft,
  calmoraAAgain,
  calmoraB,
  discharge,
  input,
  nyquilBarcode,
  nyquilBarcodeNoPhoto,
  nyquilBarcodePhotoDiffers,
  prescription,
  prescriptionStrengthUnknown,
} from "./__fixtures__/entries";
import { runChecks } from "./index";

const everything = input(
  nyquilBarcode,
  nyquilBarcodePhotoDiffers,
  nyquilBarcodeNoPhoto,
  calmoraA,
  calmoraAAgain,
  calmoraB,
  prescription,
  discharge,
  prescriptionStrengthUnknown,
);

describe("runChecks", () => {
  it("returns exactly six runs in CHECK_IDS order", () => {
    expect(runChecks(everything).map((r) => r.check)).toEqual([...CHECK_IDS]);
  });

  it("marks every check not applicable with no entries", () => {
    const runs = runChecks(input());
    expect(runs).toHaveLength(6);
    expect(runs.every((r) => r.status === "not_applicable")).toBe(true);
  });

  it("ignores draft entries", () => {
    const runs = runChecks(input(calmoraADraft, calmoraAAgain));
    expect(runs.find((r) => r.check === "repeated_record")!.status).toBe("not_applicable");
  });

  it("finds something in every check for the full demo record", () => {
    const runs = runChecks(everything);
    expect(runs.map((r) => r.status)).toEqual(["finding", "finding", "finding", "finding", "finding", "finding"]);
  });

  it("never says 'safe' anywhere", () => {
    for (const inp of [everything, input(), input(calmoraA), input(calmoraA, calmoraAAgain), input(nyquilBarcode)]) {
      expect(JSON.stringify(runChecks(inp)).toLowerCase()).not.toContain("safe");
    }
  });

  it("phrases every no_finding as 'No … found in confirmed fields'", () => {
    const runs = runChecks(input(nyquilBarcode, calmoraA, discharge)).filter((r) => r.status === "no_finding");
    expect(runs.length).toBeGreaterThan(0);
    for (const r of runs) expect(r.summary).toMatch(/^No .+ found in confirmed fields$/);
  });

  it("produces deterministic, unique finding ids", () => {
    const a = runChecks(everything).flatMap((r) => r.findings.map((f) => f.id));
    const b = runChecks({ ...everything, entries: [...everything.entries].reverse() }).flatMap((r) =>
      r.findings.map((f) => f.id),
    );
    expect(new Set(a).size).toBe(a.length);
    expect([...b].sort()).toEqual([...a].sort());
  });
});
