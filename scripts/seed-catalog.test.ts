import { describe, expect, it } from "vitest";
import { FICTIONAL_FORMULATIONS } from "@/data/fictional-formulations";
import { formatStrength } from "@/lib/domain/fields";
import { fixtureLabel, fixtureProducts, type FixtureName } from "@/lib/fda/__fixtures__";
import { formulationToRow, type CatalogFormulation } from "@/lib/openfda";
import { SEED_SPECS, buildSeedRow, changedColumns, fictionalCatalogRows, matchesSpec, productNdcsOf, seedFormulations, type SeedSpec } from "./seed-catalog";

/** A saved real label mapped the way the seed maps it: the import's mapper, with its NDC Directory products. */
const mapped = (name: FixtureName): CatalogFormulation => {
  const [f] = seedFormulations([fixtureLabel(name)], fixtureProducts(name));
  if (!f) throw new Error(`${name} did not map`);
  return f;
};
const NYQUIL = mapped("nyquil-severe-caplet");
const CHILDRENS = mapped("childrens-tylenol-suspension");

const NYQUIL_SEVERE: SeedSpec = {
  slug: "nyquil-severe-cold-flu-caplet",
  brandName: "NyQuil Severe Cold & Flu (caplets)",
  search: "x",
  dosageForm: "caplet",
  strengths: { acetaminophen: "325 mg per caplet", dextromethorphan: "10 mg per caplet", doxylamine: "6.25 mg per caplet", phenylephrine: "5 mg per caplet" },
  preferNdc: "37000-523-02",
};

describe("seedFormulations", () => {
  it("maps a label with the import's mapper: the label's strength confirmed by its NDC product, the NDC labeler", () => {
    const f = mapped("tylenol-extra-strength-caplet");
    expect(f.dosageForm).toBe("caplet");
    expect(f.activeIngredients.map((i) => `${i.normalized} ${formatStrength(i.strength)}`)).toEqual(["acetaminophen 500 mg per caplet"]);
    expect(f.labelerName).toBe("Kenvue Brands LLC");
    expect(f.ndcPackages).toEqual(["50580047201", "50580047202", "50580047203", "50580047204"]);
    expect(f.labelSections.uses?.length).toBeGreaterThan(0);
  });

  it("keeps the per-quantity the label prints (Pepto-Bismol chewables)", () => {
    expect(mapped("pepto-bismol-reyes").activeIngredients.map((i) => formatStrength(i.strength))).toEqual(["262 mg per chewable tablet"]);
  });

  it("gives a label openFDA serves without an openfda block the block of its NDC products", () => {
    const label = fixtureLabel("tylenol-extra-strength-tablet");
    label.openfda = {};
    const products = fixtureProducts("tylenol-extra-strength-tablet").map((p) => ({ ...p, spl_id: "a-newer-spl-version" }));
    expect(seedFormulations([label], [])).toEqual([]); // no block, no products: not an OTC label we can place
    const [f] = seedFormulations([label], [], products);
    expect(f.brandName).toBe("TYLENOL Extra Strength");
    expect(f.labelerName).toBe("Kenvue Brands LLC");
    expect(f.activeIngredients.map((i) => formatStrength(i.strength))).toEqual(["500 mg per tablet"]);
    expect(f.ndcPackages.length).toBeGreaterThan(0);
  });

  it("keeps every package NDC openFDA lists for a one-row label, also those its NDC products no longer list", () => {
    const label = fixtureLabel("motrin-ib");
    label.openfda = { ...label.openfda, package_ndc: [...(label.openfda?.package_ndc ?? []), "50580-230-99"] };
    const [f] = seedFormulations([label], fixtureProducts("motrin-ib"));
    expect(f.ndcPackages).toContain("50580023099");
    expect(f.ndcPackages).toContain("50580023001");
  });

  it("leaves out labels the import rejects", () => {
    expect(seedFormulations([fixtureLabel("homeopathic-pellets")], fixtureProducts("homeopathic-pellets"))).toEqual([]);
  });
});

describe("productNdcsOf", () => {
  it("is the product part of each package NDC on the label, once each", () => {
    expect(productNdcsOf(fixtureLabel("tylenol-extra-strength-caplet"))).toEqual(["50580-472"]);
    expect(productNdcsOf({ openfda: { package_ndc: ["0280-6000-06", "0280-6000-24", "bad"] } })).toEqual(["0280-6000"]);
    expect(productNdcsOf({})).toEqual([]);
  });
});

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
    labelEffectiveDate: "2099-01-01",
    openfdaSetId: "other",
  };

  it("merges NDCs of every matching label and takes text from the preferred NDC's label", () => {
    const row = buildSeedRow(NYQUIL_SEVERE, [relabel, NYQUIL, CHILDRENS])!;
    expect(row.slug).toBe("nyquil-severe-cold-flu-caplet");
    expect(row.brandName).toBe("NyQuil Severe Cold & Flu (caplets)");
    expect(row.ndcPackages).toEqual(["37000052302", "66715990502"]);
    expect(row.openfdaSetId).toBe(NYQUIL.openfdaSetId);
    expect(row.directionsText).toBe(NYQUIL.directionsText);
    expect(row.labelSections).toEqual(NYQUIL.labelSections);
  });

  it("groups only labels that print the same inactive ingredients as the label it takes text from (flavors stay apart)", () => {
    const sections = (inactive: string) => ({ ...NYQUIL.labelSections, inactive_ingredients: [inactive] });
    const own = NYQUIL.labelSections.inactive_ingredients!.join(" ");
    const sameText = { ...relabel, ndcPackages: ["11111111111"], openfdaSetId: "same", labelSections: sections(own.toUpperCase().replace(/,/g, " ,")) };
    const cherry = { ...relabel, ndcPackages: ["22222222222"], openfdaSetId: "cherry", labelSections: sections(`${own}, FD&C red no. 40`) };
    const row = buildSeedRow(NYQUIL_SEVERE, [NYQUIL, sameText, cherry])!;
    expect(row.openfdaSetId).toBe(NYQUIL.openfdaSetId);
    expect(row.ndcPackages).toEqual(["11111111111", "37000052302"]);
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
  const DEMO_BRANDS = [/pepto-bismol/i, /tylenol/i, /midol/i, /aleve/i, /benadryl/i, /motrin/i];

  it("lists the hand-checked real formulations with unique slugs", () => {
    expect(SEED_SPECS.length).toBeGreaterThanOrEqual(20);
    expect(SEED_SPECS.length).toBeLessThanOrEqual(30);
    expect(new Set(SEED_SPECS.map((s) => s.slug)).size).toBe(SEED_SPECS.length);
    expect(SEED_SPECS.some((s) => /nyquil/i.test(s.brandName))).toBe(true);
  });

  it("covers every demo brand, and the children's liquids of Tylenol, Motrin and Benadryl", () => {
    for (const brand of DEMO_BRANDS) expect(SEED_SPECS.some((s) => brand.test(s.brandName)), String(brand)).toBe(true);
    const childrensLiquid = (name: RegExp, ingredient: string, strength: string) =>
      SEED_SPECS.some((s) => name.test(s.brandName) && /children/i.test(s.brandName) && s.dosageForm === "liquid" && s.strengths[ingredient] === strength);
    expect(childrensLiquid(/tylenol/i, "acetaminophen", "160 mg per 5 mL")).toBe(true);
    expect(childrensLiquid(/motrin/i, "ibuprofen", "100 mg per 5 mL")).toBe(true);
    expect(childrensLiquid(/benadryl/i, "diphenhydramine", "12.5 mg per 5 mL")).toBe(true);
  });

  it("prefers a hyphenated package NDC where it names the label to take text from", () => {
    for (const s of SEED_SPECS) if (s.preferNdc) expect(s.preferNdc, s.slug).toMatch(/^\d{4,5}-\d{3,4}-\d{1,2}$/);
  });

  it("searches exactly one label when it supplies that label's NDC products", () => {
    for (const s of SEED_SPECS.filter((x) => x.ndcProducts)) {
      expect(s.search, s.slug).toMatch(/^set_id:"[0-9a-f-]{36}"$/);
      for (const p of s.ndcProducts!) expect(p, s.slug).toMatch(/^\d{4,5}-\d{3,4}$/);
    }
  });

  it("keeps the fixed slug the demo household looks up for Tylenol Extra Strength", () => {
    const es = SEED_SPECS.find((s) => s.slug === "tylenol-extra-strength-500mg-caplet");
    expect(es).toMatchObject({ dosageForm: "caplet", strengths: { acetaminophen: "500 mg per caplet" } });
  });

  it("matches the saved real labels", () => {
    for (const name of ["nyquil-severe-caplet", "childrens-tylenol-suspension", "tylenol-extra-strength-caplet", "tylenol-pm-extra-strength", "motrin-ib"] as const) {
      expect(SEED_SPECS.some((s) => matchesSpec(mapped(name), s)), name).toBe(true);
    }
  });
});

describe("changedColumns", () => {
  const next = formulationToRow(CHILDRENS, "2026-10-18T00:00:00Z");
  const live = { ...next, id: "x", created_at: "y", reviewed_at: "2026-10-17T00:00:00Z", ndc_packages: [...next.ndc_packages!].reverse() };

  it("is empty when only the order of NDCs, reviewed_at or enrichment-owned card text differ", () => {
    expect(changedColumns(next, { ...live, label_sections: {}, labeler_name: "x", source_links: [] })).toEqual([]);
  });

  it("ignores the key order jsonb returns", () => {
    const reverse = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).reverse());
    const reordered = (next.active_ingredients as { strength: Record<string, unknown> }[]).map((i) => reverse({ ...i, strength: reverse(i.strength) }));
    expect(changedColumns(next, { ...live, active_ingredients: reordered as typeof live.active_ingredients })).toEqual([]);
  });

  it("names the seed-owned columns that differ", () => {
    expect(changedColumns(next, { ...live, dosage_form: "tablet", max_24h_text: null, ndc_packages: [] })).toEqual(["dosage_form", "ndc_packages", "max_24h_text"]);
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
