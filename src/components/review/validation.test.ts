import { describe, expect, it } from "vitest";
import type { EntryFields, Field } from "@/lib/domain/schema";
import { parseDoseInput, parseStrengthInput, parseTextInput, validateReviewFields } from "./validation";

const strengthText = { amount: "160", unit: "mg", perAmount: "5", perUnit: "mL" };

describe("parseStrengthInput", () => {
  it("reads a complete strength", () => {
    expect(parseStrengthInput(strengthText)).toEqual({
      value: { amount: 160, unit: "mg", perAmount: 5, perUnit: "mL" },
      errors: {},
    });
  });

  it("allows decimals and an empty per amount ('each')", () => {
    expect(parseStrengthInput({ ...strengthText, amount: " 0.5 ", perAmount: "" }).value).toEqual({
      amount: 0.5,
      unit: "mg",
      perAmount: null,
      perUnit: "mL",
    });
  });

  it("allows no per part at all", () => {
    expect(parseStrengthInput({ ...strengthText, perAmount: "", perUnit: " " }).value).toEqual({
      amount: 160,
      unit: "mg",
      perAmount: null,
      perUnit: null,
    });
  });

  it.each(["0", "-5", "0.0", "abc", "", "  ", "1e3", "5 mg"])("rejects amount %j with an explanation", (amount) => {
    const r = parseStrengthInput({ ...strengthText, amount });
    expect(r.value).toBeNull();
    expect(r.errors.amount).toMatch(/greater than 0/);
  });

  it.each(["0", "-5", "x"])("rejects per amount %j instead of dropping it", (perAmount) => {
    const r = parseStrengthInput({ ...strengthText, perAmount });
    expect(r.value).toBeNull();
    expect(r.errors.perAmount).toMatch(/greater than 0/);
  });

  it("asks for the per unit when a per amount is typed", () => {
    const r = parseStrengthInput({ ...strengthText, perUnit: "" });
    expect(r.value).toBeNull();
    expect(r.errors.perUnit).toBeTruthy();
  });

  it("reports every problem at once", () => {
    const r = parseStrengthInput({ ...strengthText, amount: "0", perAmount: "-1" });
    expect(Object.keys(r.errors).sort()).toEqual(["amount", "perAmount"]);
  });
});

describe("parseDoseInput", () => {
  it("reads a dose exactly as written", () => {
    expect(parseDoseInput({ amount: "2", unit: " tsp " })).toEqual({ value: { amount: 2, unit: "tsp" }, errors: {} });
  });

  it.each(["0", "-5", "two", ""])("rejects amount %j with an explanation", (amount) => {
    const r = parseDoseInput({ amount, unit: "mL" });
    expect(r.value).toBeNull();
    expect(r.errors.amount).toMatch(/greater than 0/);
  });

  it("asks for the unit", () => {
    const r = parseDoseInput({ amount: "5", unit: "" });
    expect(r.value).toBeNull();
    expect(r.errors.unit).toBeTruthy();
  });
});

describe("parseTextInput", () => {
  it("trims the text", () => {
    expect(parseTextInput("  Calmora ")).toEqual({ value: "Calmora", error: null });
  });

  it("explains an empty value instead of turning it into Can't tell", () => {
    const r = parseTextInput("   ");
    expect(r.value).toBeNull();
    expect(r.error).toMatch(/Can't tell/);
  });
});

describe("validateReviewFields", () => {
  const evidence = { kind: "photo", sourceDocumentId: "d" } as const;
  const field = <T>(value: T | null, state: Field<T>["state"] = "confirmed"): Field<T> => ({
    aiValue: value,
    value,
    state,
    evidence,
  });
  const valid: EntryFields = {
    productName: field("Calmora"),
    dosageForm: field("liquid"),
    ingredients: [
      { name: field("acetaminophen"), strength: field({ amount: 160, unit: "mg", perAmount: 5, perUnit: "mL" }) },
    ],
    instructions: field("See label"),
    doseAsWritten: field(null, "unknown"),
    max24h: field(null, "unknown"),
  };

  it("accepts valid fields", () => {
    expect(validateReviewFields(valid)).toEqual({ fields: valid });
  });

  it("explains a strength that isn't greater than 0", () => {
    const bad = structuredClone(valid);
    bad.ingredients[0].strength.value = { amount: 0, unit: "mg", perAmount: 5, perUnit: "mL" };
    expect(validateReviewFields(bad)).toEqual({ error: expect.stringMatching(/strength.*greater than 0/i) });
  });

  it("explains a per amount that isn't greater than 0", () => {
    const bad = structuredClone(valid);
    bad.ingredients[0].strength.value = { amount: 160, unit: "mg", perAmount: -5, perUnit: "mL" };
    expect(validateReviewFields(bad)).toEqual({ error: expect.stringMatching(/strength.*greater than 0/i) });
  });

  it("explains a dose amount that isn't greater than 0", () => {
    const bad = structuredClone(valid);
    bad.doseAsWritten = field({ amount: -1, unit: "mL" }, "edited");
    expect(validateReviewFields(bad)).toEqual({ error: expect.stringMatching(/amount.*greater than 0/i) });
  });

  it("rejects a confirmed or edited field with no value instead of storing it", () => {
    const bad = structuredClone(valid);
    bad.productName = field<string>(null, "edited");
    expect(validateReviewFields(bad)).toHaveProperty("error");
  });

  it("falls back to a general message for other problems", () => {
    expect(validateReviewFields({ ...valid, ingredients: "x" })).toEqual({ error: expect.any(String) });
  });
});
