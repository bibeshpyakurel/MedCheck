import { describe, expect, it } from "vitest";
import { normalizeIngredient } from "./ingredients";

describe("normalizeIngredient", () => {
  it.each([
    ["Acetaminophen", "acetaminophen"],
    ["Paracetamol", "acetaminophen"],
    ["APAP", "acetaminophen"],
    ["Acetaminophen 325 mg", "acetaminophen"],
    ["Acetaminophen (in each 5 mL) 160 mg", "acetaminophen"],
    ["acetaminophen USP", "acetaminophen"],
    ["Dextromethorphan HBr 10 mg", "dextromethorphan"],
    ["Doxylamine succinate 6.25 mg", "doxylamine"],
    ["Phenylephrine HCl", "phenylephrine"],
  ])("%s → %s", (raw, expected) => {
    expect(normalizeIngredient(raw)).toBe(expected);
  });

  it("keeps unknown ingredients readable instead of guessing", () => {
    expect(normalizeIngredient("  Zinc Gluconate ")).toBe("zinc gluconate");
  });
});
