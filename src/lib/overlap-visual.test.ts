import { describe, expect, it } from "vitest";
import { calmoraA, calmoraB, ibuprofen, input, nyquilBarcode } from "@/lib/checks/__fixtures__/entries";
import { runChecks } from "@/lib/checks";
import { INGREDIENT_SLOTS, ingredientSlot, ingredientTone } from "@/lib/ingredient-colors";
import { overlappingIngredients, overlapVisual, vennLabel } from "@/lib/overlap-visual";

function setup(...entries: Parameters<typeof input>) {
  const checkInput = input(...entries);
  const findings = runChecks(checkInput).flatMap((r) => r.findings);
  const byId = new Map(checkInput.entries.map((e) => [e.id, e]));
  return { findings, byId };
}

describe("overlapVisual", () => {
  it("names the shared ingredient and each product with its own strength, as shown elsewhere", () => {
    const { findings, byId } = setup(nyquilBarcode, calmoraA);
    const overlap = findings.find((f) => f.check === "ingredient_overlap")!;
    expect(overlapVisual(overlap, byId)).toEqual({
      ingredient: "Acetaminophen",
      normalized: "acetaminophen",
      products: [
        { entryId: "e-nyquil", name: "NyQuil Cold & Flu Nighttime Relief", strength: "325 mg per caplet" },
        { entryId: "e-calmora-a", name: "Calmora Fever Relief (Bottle A)", strength: "100 mg per 5 mL" },
      ],
    });
  });

  it("is null for findings that aren't an ingredient overlap", () => {
    const { findings, byId } = setup(calmoraA, calmoraB);
    for (const f of findings.filter((f) => f.check !== "ingredient_overlap")) expect(overlapVisual(f, byId)).toBeNull();
  });
});

describe("vennLabel", () => {
  const product = (name: string, strength: string | null) => ({ entryId: name, name, strength });

  it("reads the diagram as one sentence, each strength on its own", () => {
    expect(
      vennLabel({ ingredient: "Acetaminophen", normalized: "acetaminophen", products: [product("Tylenol", "500 mg per caplet"), product("DayQuil", "325 mg per 15 mL")] }),
    ).toBe("Tylenol and DayQuil both contain Acetaminophen. Tylenol: 500 mg per caplet. DayQuil: 325 mg per 15 mL.");
  });

  it("lists three or more, and says when a strength is unknown", () => {
    expect(
      vennLabel({ ingredient: "Acetaminophen", normalized: "acetaminophen", products: [product("A", "1 mg"), product("B", null), product("C", "2 mg")] }),
    ).toBe("A, B and C all contain Acetaminophen. A: 1 mg. B: strength unknown. C: 2 mg.");
  });
});

describe("overlappingIngredients", () => {
  it("collects the normalized names of every shared ingredient", () => {
    const { findings, byId } = setup(nyquilBarcode, calmoraA, ibuprofen);
    expect(overlappingIngredients(findings, byId)).toEqual(new Set(["acetaminophen"]));
  });

  it("is empty with nothing shared", () => {
    const { findings, byId } = setup(calmoraA, ibuprofen);
    expect(overlappingIngredients(findings, byId).size).toBe(0);
  });
});

describe("ingredient colors", () => {
  it("gives every spelling of one ingredient the same slot", () => {
    expect(ingredientSlot("Dextromethorphan HBr")).toBe(ingredientSlot("dextromethorphan hydrobromide"));
    expect(ingredientSlot("Acetaminophen USP")).toBe(ingredientSlot("APAP"));
  });

  it("stays within the palette", () => {
    for (const name of ["Acetaminophen", "Ibuprofen", "Guaifenesin", "Phenylephrine HCl", "Doxylamine succinate", "x"]) {
      const slot = ingredientSlot(name);
      expect(slot).toBeGreaterThanOrEqual(1);
      expect(slot).toBeLessThanOrEqual(INGREDIENT_SLOTS);
    }
  });

  it("shows a shared ingredient in the overlap tone, whatever its slot", () => {
    const shared = new Set(["acetaminophen"]);
    expect(ingredientTone("Acetaminophen 500 mg", shared)).toBe("overlap");
    expect(ingredientTone("Ibuprofen", shared)).toBe(`ing-${ingredientSlot("Ibuprofen")}`);
  });
});
