import { describe, expect, it } from "vitest";
import { FICTIONAL_FORMULATIONS } from "@/data/fictional-formulations";
import childrens from "@/lib/__fixtures__/openfda-childrens-tylenol-160mg-5ml.json";
import nyquil from "@/lib/__fixtures__/openfda-nyquil-37000-523-02.json";
import { labelToFormulation, type CatalogFormulation, type OpenFdaLabel } from "@/lib/openfda";
import { SEED_SPECS, buildSeedRow, fictionalCatalogRows, matchesSpec, type SeedSpec } from "./seed-catalog";

const NYQUIL = labelToFormulation(nyquil as OpenFdaLabel)!;
const CHILDRENS = labelToFormulation(childrens as OpenFdaLabel)!;

const NYQUIL_SEVERE: SeedSpec = {
  slug: "nyquil-severe-cold-flu-caplet",
  brandName: "NyQuil Severe Cold & Flu (caplets)",
  search: "x",
  dosageForm: "caplet",
  strengths: { acetaminophen: "325 mg per caplet", dextromethorphan: "10 mg per caplet", doxylamine: "6.25 mg per caplet", phenylephrine: "5 mg per caplet" },
  preferNdc: "37000-523-02",
};

describe("matchesSpec", () => {
  it("matches on dosage form and the exact set of ingredient strengths", () => {
    expect(matchesSpec(NYQUIL, NYQUIL_SEVERE)).toBe(true);
    expect(matchesSpec(CHILDRENS, NYQUIL_SEVERE)).toBe(false);
  });

  it("does not match a subset or superset of ingredients", () => {
    const withoutPe = { ...NYQUIL_SEVERE, strengths: { acetaminophen: "325 mg per caplet", dextromethorphan: "10 mg per caplet", doxylamine: "6.25 mg per caplet" } };
    expect(matchesSpec(NYQUIL, withoutPe)).toBe(false);
  });

  it("does not match a different form", () => {
    expect(matchesSpec(NYQUIL, { ...NYQUIL_SEVERE, dosageForm: "liquid" })).toBe(false);
  });

  it("honors excludeBrand", () => {
    expect(matchesSpec(NYQUIL, { ...NYQUIL_SEVERE, excludeBrand: /nyquil/i })).toBe(false);
  });
});

describe("buildSeedRow", () => {
  const relabel: CatalogFormulation = {
    ...NYQUIL,
    brandName: "NyQuil Severe Plus VapoCOOL Cold and Flu, TRAVEL BASIX",
    ndcPackages: ["66715990502"],
    labelEffectiveDate: "2026-01-01",
    openfdaSetId: "other",
  };

  it("merges NDCs of every matching label and takes text from the preferred NDC's label", () => {
    const row = buildSeedRow(NYQUIL_SEVERE, [relabel, NYQUIL, CHILDRENS])!;
    expect(row.slug).toBe("nyquil-severe-cold-flu-caplet");
    expect(row.brandName).toBe("NyQuil Severe Cold & Flu (caplets)");
    expect(row.ndcPackages).toEqual(["37000052302", "66715990502"]);
    expect(row.openfdaSetId).toBe(NYQUIL.openfdaSetId);
    expect(row.directionsText).toBe(NYQUIL.directionsText);
  });

  it("falls back to the most recent label without a preferred NDC", () => {
    const row = buildSeedRow({ ...NYQUIL_SEVERE, preferNdc: undefined }, [NYQUIL, relabel])!;
    expect(row.openfdaSetId).toBe("other");
  });

  it("returns null when nothing matches", () => {
    expect(buildSeedRow(NYQUIL_SEVERE, [CHILDRENS])).toBeNull();
  });
});

describe("SEED_SPECS", () => {
  it("lists 6–10 real formulations with unique slugs, including NyQuil and a children's 160 mg per 5 mL liquid", () => {
    expect(SEED_SPECS.length).toBeGreaterThanOrEqual(6);
    expect(SEED_SPECS.length).toBeLessThanOrEqual(10);
    expect(new Set(SEED_SPECS.map((s) => s.slug)).size).toBe(SEED_SPECS.length);
    expect(SEED_SPECS.some((s) => /nyquil/i.test(s.brandName))).toBe(true);
    expect(
      SEED_SPECS.some((s) => s.dosageForm === "liquid" && s.strengths.acetaminophen === "160 mg per 5 mL"),
    ).toBe(true);
    for (const s of SEED_SPECS) expect(s.strengths.acetaminophen).toBeDefined();
  });

  it("keeps the fixed slug the demo household looks up for Tylenol Extra Strength", () => {
    const es = SEED_SPECS.find((s) => s.slug === "tylenol-extra-strength-500mg-caplet");
    expect(es).toMatchObject({ dosageForm: "caplet", strengths: { acetaminophen: "500 mg per caplet" } });
  });

  it("matches the saved real labels", () => {
    expect(SEED_SPECS.some((s) => matchesSpec(NYQUIL, s))).toBe(true);
    expect(SEED_SPECS.some((s) => matchesSpec(CHILDRENS, s))).toBe(true);
  });
});

describe("fictionalCatalogRows", () => {
  it("drops the barcode-only fields and keeps the catalog shape", () => {
    const rows = fictionalCatalogRows();
    expect(rows).toHaveLength(FICTIONAL_FORMULATIONS.length);
    for (const row of rows) {
      expect(row).not.toHaveProperty("upcA");
      expect(row).not.toHaveProperty("ndc10");
      expect(row.isFictional).toBe(true);
      expect(row.source).toBe("fictional");
    }
  });
});
