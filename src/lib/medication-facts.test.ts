import { describe, expect, it } from "vitest";
import { FICTIONAL_FORMULATIONS } from "@/data/fictional-formulations";
import type { Formulation } from "@/lib/domain/schema";
import labels from "./__fixtures__/quick-answers-labels.json";
import { medicationFacts, resolveRef, STATUS_TEXT } from "./medication-facts";

// Real catalog rows (live import, October 2026), copied verbatim.
const L = labels as unknown as Record<keyof typeof labels, Formulation>;
const calmora: Formulation = { ...FICTIONAL_FORMULATIONS[0], id: "calmora-a" };

describe("header and status", () => {
  it("is fictional, hand-checked, or FDA-published, in that order of precedence", () => {
    expect(medicationFacts(calmora).header.status).toBe("fictional");
    expect(medicationFacts({ ...L.advil, reviewed: true }).header.status).toBe("hand_checked");
    expect(medicationFacts(L.advil).header.status).toBe("fda_published");
    expect(STATUS_TEXT.fda_published).toBe("FDA-published label · not hand-checked");
  });

  it("names the product, each ingredient with strength, the labeler, date and form", () => {
    expect(medicationFacts(L.advil).header).toEqual({
      name: "ADVIL",
      ingredients: ["Ibuprofen 200 mg per tablet"],
      labeler: "Haleon US Holdings LLC",
      labelDate: "2026-03-12",
      dosageForm: "tablet",
      status: "fda_published",
    });
  });
});

describe("ingredient card", () => {
  it("splits each strength into its amount and what it is per", () => {
    expect(medicationFacts(L.advil).hero.ingredients).toEqual([{ name: "Ibuprofen", amount: "200 mg", per: "per tablet" }]);
    expect(medicationFacts(L.childrensTylenol).hero.ingredients[0]).toMatchObject({ amount: "160 mg", per: "per 5 mL" });
  });

  it("quotes the label's Purpose lines", () => {
    expect(medicationFacts(L.advil).hero.purposes.map((l) => l.text)).toEqual(["Pain reliever/Fever reducer"]);
    expect(medicationFacts(L.advil).hero.purposes[0].ref).toEqual({ source: "purpose", index: 0 });
  });
});

describe("resolveRef", () => {
  it("returns the raw text a ref points at", () => {
    expect(resolveRef(L.advil, { source: "uses", index: 1 })).toBe("toothache");
    expect(resolveRef(L.advil, { source: "max_24h_text", index: 0 })).toBe(L.advil.max24hText);
    expect(resolveRef(L.advil, { source: "warnings_quotes", index: 0 })).toBe(L.advil.warningsQuotes[0]);
    expect(resolveRef(L.advil, { source: "uses", index: 99 })).toBeNull();
  });
});

describe("source", () => {
  it("carries the set ID, NDCs and links", () => {
    expect(medicationFacts(L.advil).source).toEqual({
      kind: "openfda",
      setId: "1a665e64-9f30-be37-4a83-38789f1f1e89",
      ndcs: ["00573016520"],
      links: L.advil.sourceLinks,
    });
  });
});
