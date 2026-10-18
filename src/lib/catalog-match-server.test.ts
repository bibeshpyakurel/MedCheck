import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PhotoRead } from "./catalog-match";
import type { Formulation } from "./domain/schema";

vi.mock("server-only", () => ({}));
const searchFormulations = vi.fn<(query: string, max?: number) => Promise<Formulation[]>>();
vi.mock("@/lib/catalog", () => ({ searchFormulations: (q: string, max?: number) => searchFormulations(q, max) }));

const { findCatalogMatches } = await import("./catalog-match-server");

function label(id: string, brandName: string, amount: number, isFictional = false): Formulation {
  return {
    id,
    slug: id,
    brandName,
    genericName: "Acetaminophen",
    dosageForm: "caplet",
    isFictional,
    ndcPackages: [],
    activeIngredients: [{ name: "Acetaminophen", normalized: "acetaminophen", strength: { amount, unit: "mg", perAmount: 1, perUnit: "caplet" } }],
    directionsText: null,
    max24hText: null,
    warningsQuotes: [],
    dosageTableHtml: null,
    source: isFictional ? "fictional" : "openfda",
    openfdaSetId: null,
    labelEffectiveDate: null,
    labelerName: null,
    labelSections: {},
    sourceLinks: [],
    reviewed: true,
  };
}

const read: PhotoRead = {
  productName: "Extra Strength",
  dosageForm: "caplets",
  ingredients: [{ name: "Acetaminophen", strength: { amount: 500, unit: "mg", perAmount: 1, perUnit: "caplet" } }],
};

describe("findCatalogMatches", () => {
  beforeEach(() => searchFormulations.mockReset());

  it("never offers fictional demo products, even when they would rank first", async () => {
    const calmora = label("f-calmora", "Calmora Extra Strength", 500, true);
    const tylenol = label("f-tylenol", "Tylenol Extra Strength", 500);
    searchFormulations.mockResolvedValue([calmora, tylenol]);
    const matches = await findCatalogMatches(read);
    expect(matches.map((m) => m.formulation.id)).toEqual(["f-tylenol"]);
  });

  it("still finds the hand-checked label behind 25 same-brand copies the search ranks first (Tylenol Extra Strength)", async () => {
    const copies = Array.from({ length: 25 }, (_, i) => ({ ...label(`f-copy-${i}`, "Tylenol Extra Strength", 500), reviewed: false }));
    const checked = label("f-checked", "Tylenol Extra Strength (caplets)", 500);
    searchFormulations.mockImplementation(async (_q, max) => [...copies, checked].slice(0, max));
    const [best] = await findCatalogMatches({ ...read, productName: "Tylenol Extra Strength" });
    expect(best.formulation.id).toBe("f-checked");
  });

  it("still fills the limit with real labels", async () => {
    const real = Array.from({ length: 6 }, (_, i) => label(`f-${i}`, `Brand ${i} Extra Strength`, 500));
    searchFormulations.mockResolvedValue([label("f-calmora", "Calmora Extra Strength", 500, true), ...real]);
    expect(await findCatalogMatches(read)).toHaveLength(6);
  });
});
