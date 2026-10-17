import { describe, expect, it } from "vitest";
import { emptyEntryFields, formatStrength, isFullyReviewed, isUsable, suggestedField } from "./fields";

describe("formatStrength", () => {
  it("formats liquid concentration", () => {
    expect(formatStrength({ amount: 100, unit: "mg", perAmount: 5, perUnit: "mL" })).toBe("100 mg per 5 mL");
  });
  it("formats per-unit solids", () => {
    expect(formatStrength({ amount: 325, unit: "mg", perAmount: 1, perUnit: "caplet" })).toBe("325 mg per caplet");
  });
  it("formats a bare amount", () => {
    expect(formatStrength({ amount: 6.25, unit: "mg", perAmount: null, perUnit: null })).toBe("6.25 mg");
  });
});

describe("field states", () => {
  it("a suggestion is pending and not usable until confirmed", () => {
    const f = suggestedField("Acetaminophen", { kind: "none" });
    expect(f.state).toBe("pending");
    expect(isUsable(f)).toBe(false);
    expect(isUsable({ ...f, state: "confirmed" })).toBe(true);
  });
  it("a missing suggestion starts unknown", () => {
    expect(suggestedField(null, { kind: "none" }).state).toBe("unknown");
  });
  it("unknown is never usable", () => {
    expect(isUsable({ aiValue: "x", value: "x", state: "unknown", evidence: { kind: "none" } })).toBe(false);
  });
  it("isFullyReviewed is false while anything is pending", () => {
    const fields = emptyEntryFields();
    expect(isFullyReviewed(fields)).toBe(true);
    fields.productName = suggestedField("Calmora", { kind: "none" });
    expect(isFullyReviewed(fields)).toBe(false);
  });
});
