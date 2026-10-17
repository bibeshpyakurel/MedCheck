import { describe, expect, it } from "vitest";
import type { Field, Strength } from "@/lib/domain/schema";
import { applyEdit, markMatches, markUnknown } from "./field-actions";

const evidence = { kind: "photo", sourceDocumentId: "d" } as const;
const strength: Strength = { amount: 100, unit: "mg", perAmount: 5, perUnit: "mL" };
const pending: Field<Strength> = { aiValue: strength, value: strength, state: "pending", evidence };

describe("markMatches", () => {
  it("confirms the suggested value", () => {
    expect(markMatches(pending)).toEqual({ ...pending, state: "confirmed" });
  });

  it("keeps a corrected value as edited", () => {
    const edited = applyEdit(pending, { ...strength, amount: 200 });
    expect(markMatches(edited).state).toBe("edited");
  });

  it("leaves a field with no value unknown", () => {
    const empty: Field<string> = { aiValue: null, value: null, state: "unknown", evidence };
    expect(markMatches(empty).state).toBe("unknown");
  });
});

describe("applyEdit", () => {
  it("marks a different value as edited and keeps the AI suggestion", () => {
    const f = applyEdit(pending, { ...strength, amount: 200 });
    expect(f.state).toBe("edited");
    expect(f.value?.amount).toBe(200);
    expect(f.aiValue).toEqual(strength);
  });

  it("treats an unchanged value (any key order) as confirmed", () => {
    const f = applyEdit(pending, { perUnit: "mL", perAmount: 5, unit: "mg", amount: 100 });
    expect(f.state).toBe("confirmed");
  });

  it("treats an empty value as unknown", () => {
    expect(applyEdit(pending, null)).toMatchObject({ value: null, state: "unknown" });
  });

  it("marks a typed value on an empty field as edited", () => {
    const empty: Field<string> = { aiValue: null, value: null, state: "unknown", evidence };
    expect(applyEdit(empty, "Calmora")).toMatchObject({ value: "Calmora", state: "edited" });
  });
});

describe("markUnknown", () => {
  it("clears the value and keeps the suggestion for the record", () => {
    expect(markUnknown(pending)).toEqual({ ...pending, value: null, state: "unknown" });
  });
});
