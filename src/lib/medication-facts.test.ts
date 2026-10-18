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

describe("uses", () => {
  const texts = (g: { tiles: { text: string }[] }) => g.tiles.map((t) => t.text);

  it("Advil: one list under its lead, then fever on its own", () => {
    const u = medicationFacts(L.advil).uses;
    expect(u.map((g) => g.lead?.text ?? null)).toEqual(["temporarily relieves minor aches and pains due to:", null]);
    expect(texts(u[0])).toEqual(["headache", "toothache", "backache", "menstrual cramps", "the common cold", "muscular aches", "minor pain of arthritis"]);
    expect(texts(u[1])).toEqual(["temporarily reduces fever"]);
    expect(u[0].tiles.map((t) => t.icon)).toEqual(["zap", "activity", "activity", "activity", "snowflake", "activity", "activity"]);
    expect(u[1].tiles[0].icon).toBe("thermometer");
  });

  it("Children's Tylenol: each colon starts a list; a leading list glyph is dropped", () => {
    const u = medicationFacts(L.childrensTylenol).uses;
    expect(u.map((g) => g.lead?.text)).toEqual(["temporarily:", "relieves minor aches and pains due to:"]);
    expect(texts(u[0])).toEqual(["reduces fever"]);
    expect(texts(u[1])).toEqual(["the common cold", "flu", "headache", "sore throat", "toothache"]);
  });

  it("Benadryl: a second lead starts a second list", () => {
    const u = medicationFacts(L.benadrylLiquid).uses;
    expect(u.map((g) => g.lead?.text)).toEqual([
      "temporarily relieves these symptoms due to hay fever or other upper respiratory allergies:",
      "temporarily relieves these symptoms due to the common cold:",
    ]);
    expect(texts(u[1])).toEqual(["runny nose", "sneezing"]);
    expect(u[1].tiles.map((t) => t.icon)).toEqual(["wind", "wind"]);
  });

  it("a Uses bullet with no colon is one tile, verbatim (Pepcid)", () => {
    const u = medicationFacts(L.pepcidAcMax).uses;
    expect(u).toHaveLength(1);
    expect(u[0].lead).toBeNull();
    expect(texts(u[0])).toEqual(L.pepcidAcMax.labelSections.uses);
    expect(u[0].tiles[0].icon).toBe("flame");
  });

  it("a label without Uses has no groups", () => {
    expect(medicationFacts({ ...L.advil, labelSections: {} }).uses).toEqual([]);
  });
});
