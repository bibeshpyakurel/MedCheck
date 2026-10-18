import { describe, expect, it } from "vitest";
import { advil, aleve, FAMILY_FORMULATIONS } from "@/lib/__fixtures__/family-formulations";
import type { Formulation } from "@/lib/domain/schema";
import {
  calmoraA,
  calmoraADraft,
  calmoraAAgain,
  calmoraB,
  discharge,
  input,
  makeEntry,
  nyquilBarcode,
  nyquilBarcodeNoPhoto,
  nyquilBarcodePhotoDiffers,
  prescription,
  prescriptionStrengthUnknown,
} from "./__fixtures__/entries";
import { ACTIVE_CHECK_IDS, CHECK_TITLES, runChecks } from "./index";

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
  it("returns one run per active check, in order", () => {
    expect(runChecks(everything).map((r) => r.check)).toEqual([
      "ingredient_overlap",
      "ingredient_family",
      "repeated_record",
      "concentration",
      "units",
      "database_vs_box",
    ]);
    expect(ACTIVE_CHECK_IDS).toEqual(runChecks(everything).map((r) => r.check));
  });

  it("names every active check", () => {
    for (const id of ACTIVE_CHECK_IDS) expect(CHECK_TITLES[id]).toBeTruthy();
    expect(CHECK_TITLES.ingredient_family).toBe("Same family of medicine");
  });

  it("no longer compares documents with the bottle", () => {
    expect(runChecks(everything).map((r) => r.check)).not.toContain("document_vs_bottle");
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

  it("finds something in every check but the family one for the full demo record", () => {
    const runs = runChecks(everything);
    // The demo medicines share acetaminophen; none holds a second ingredient of one family.
    expect(runs.map((r) => r.status)).toEqual(["finding", "no_finding", "finding", "finding", "finding", "finding"]);
  });

  it("runs the family check on confirmed entries only", () => {
    const entry = (id: string, f: Formulation, status: "draft" | "confirmed" = "confirmed") =>
      makeEntry({
        id,
        name: f.brandName,
        form: f.dosageForm,
        ingredients: f.activeIngredients.map((i) => ({ name: i.name, strength: i.strength })),
        formulationId: f.id,
        inputMethod: "picker",
        status,
      });
    const family = (status: "draft" | "confirmed") =>
      runChecks({ entries: [entry("e-advil", advil), entry("e-aleve", aleve, status)], formulations: FAMILY_FORMULATIONS }).find(
        (r) => r.check === "ingredient_family",
      )!;
    expect(family("confirmed").status).toBe("finding");
    expect(family("draft").status).toBe("not_applicable");
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
