import { describe, expect, it } from "vitest";
import {
  calmoraA,
  calmoraAAgain,
  calmoraB,
  ibuprofen,
  input,
  NYQUIL_LIVER_WARNING,
  nyquilBarcode,
  prescription,
  unreadableIngredient,
} from "./__fixtures__/entries";
import { checkIngredientOverlap } from "./overlap";

describe("ingredient overlap", () => {
  it("finds NyQuil + Calmora A sharing acetaminophen, with the label's own warning", () => {
    const run = checkIngredientOverlap(input(nyquilBarcode, calmoraA));
    expect(run.check).toBe("ingredient_overlap");
    expect(run.status).toBe("finding");
    expect(run.findings).toHaveLength(1);
    const f = run.findings[0];
    expect(f.title).toContain("Acetaminophen");
    expect(f.detail).toContain("NyQuil Cold & Flu Nighttime Relief");
    expect(f.detail).toContain("Calmora Fever Relief (Bottle A)");
    // the label text for each product
    expect(f.detail).toContain("Acetaminophen 325 mg per caplet");
    expect(f.detail).toContain("Acetaminophen 100 mg per 5 mL");
    expect(f.labelWarningQuote).toBe(NYQUIL_LIVER_WARNING);
    expect(f.entryIds).toEqual(["e-calmora-a", "e-nyquil"]);
    expect(f.id).toBe("ingredient_overlap:e-calmora-a,e-nyquil:acetaminophen");
    expect(f.evidence.map((e) => e.entryId)).toEqual(["e-nyquil", "e-calmora-a"]);
    expect(f.evidence[0].text).toBe("Acetaminophen 325 mg per caplet");
    expect(f.evidence[0].documentKind).toBe("drug_facts_photo");
    expect(f.pharmacistQuestion).toContain("acetaminophen");
  });

  it("never claims the dose doubled", () => {
    const text = JSON.stringify(checkIngredientOverlap(input(nyquilBarcode, calmoraA))).toLowerCase();
    expect(text).not.toMatch(/doubl|twice the|2x|safe/);
  });

  it("does not report a repeat of the same product as an overlap", () => {
    const run = checkIngredientOverlap(input(calmoraA, calmoraAAgain));
    expect(run.status).toBe("no_finding");
    expect(run.summary).toBe("No shared active ingredients found in confirmed fields");
  });

  it("counts a repeated product once among distinct products", () => {
    const run = checkIngredientOverlap(input(calmoraA, calmoraAAgain, calmoraB));
    expect(run.findings).toHaveLength(1);
    expect(run.findings[0].entryIds).toEqual(["e-calmora-a", "e-calmora-b"]);
  });

  it("uses no warning quote when no catalog label mentions the ingredient", () => {
    const run = checkIngredientOverlap(input(calmoraB, prescription));
    expect(run.findings[0].labelWarningQuote).toBeNull();
  });

  it("is no_finding when nothing is shared", () => {
    const run = checkIngredientOverlap(input(calmoraA, ibuprofen));
    expect(run.status).toBe("no_finding");
  });

  it("is unresolved when an ingredient name is unreadable", () => {
    const run = checkIngredientOverlap(input(calmoraA, unreadableIngredient));
    expect(run.status).toBe("unresolved");
    expect(run.reasons).toEqual(["Active ingredient unreadable on Package label (Night Cold Relief)"]);
  });

  it("is not applicable with fewer than two medicines", () => {
    expect(checkIngredientOverlap(input(calmoraA)).status).toBe("not_applicable");
    expect(checkIngredientOverlap(input()).status).toBe("not_applicable");
  });
});
