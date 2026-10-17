import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { detectAlreadyGaveBoth, fieldsFromDescription, toDescribedMedication, type GeminiDescription } from "./describe";

const TRANSCRIPT = "Children's Calmora fever relief, 100 mg per 5 mL, I give 5 mL every 6 hours";

function raw(overrides: Partial<GeminiDescription> = {}): GeminiDescription {
  return {
    transcript: TRANSCRIPT,
    alreadyGaveBoth: false,
    medication: {
      productName: { value: "Children's Calmora fever relief", quote: "Children's Calmora fever relief" },
      dosageForm: { value: null, quote: null },
      ingredients: [
        {
          name: { value: null, quote: null },
          strength: { amount: 100, unit: "mg", perAmount: 5, perUnit: "mL", quote: "100 mg per 5 mL" },
        },
      ],
      instructions: { value: "I give 5 mL every 6 hours", quote: "made-up words the user never said" },
      doseAsWritten: { amount: 5, unit: "mL", quote: null },
      max24h: { value: null, quote: null },
    },
    ...overrides,
  };
}

describe("toDescribedMedication", () => {
  it("uses the user's own words as quote evidence", () => {
    const { medication } = toDescribedMedication(raw(), TRANSCRIPT);
    expect(medication).not.toBeNull();
    expect(medication!.productName.evidence).toEqual({ kind: "quote", text: "Children's Calmora fever relief" });
    expect(medication!.ingredients[0].strength.evidence).toEqual({ kind: "quote", text: "100 mg per 5 mL" });
    expect(medication!.ingredients[0].strength.state).toBe("pending");
  });

  it("falls back to the whole transcript when the quote is missing or not in the transcript", () => {
    const { medication } = toDescribedMedication(raw(), TRANSCRIPT);
    expect(medication!.instructions.evidence).toEqual({ kind: "quote", text: TRANSCRIPT });
    expect(medication!.doseAsWritten.evidence).toEqual({ kind: "quote", text: TRANSCRIPT });
  });

  it("turns values the user didn't say into unknown", () => {
    const { medication } = toDescribedMedication(raw(), TRANSCRIPT);
    expect(medication!.dosageForm.state).toBe("unknown");
    expect(medication!.max24h.state).toBe("unknown");
    expect(medication!.ingredients[0].name.state).toBe("unknown");
  });

  it("returns no medication when none was described", () => {
    expect(toDescribedMedication(raw({ medication: null }), TRANSCRIPT).medication).toBeNull();
  });

  it("flags 'already gave both' from the transcript even if the model missed it", () => {
    const t = "Oops, I already gave both the Calmora and the NyQuil";
    expect(toDescribedMedication(raw({ transcript: t }), t).alreadyGaveBoth).toBe(true);
  });

  it("trusts the model's flag too", () => {
    expect(toDescribedMedication(raw({ alreadyGaveBoth: true }), TRANSCRIPT).alreadyGaveBoth).toBe(true);
  });
});

describe("detectAlreadyGaveBoth", () => {
  it.each([
    "I already gave both",
    "I think I gave him both bottles",
    "we gave two doses by accident",
    "she took it twice",
    "I gave her the medicine twice this morning",
    "Accidentally gave a double dose",
    "I double-dosed him",
    "he took 2 doses",
    "I ALREADY GAVE BOTH!!",
    "I’ve already given both",
  ])("detects %s", (text) => {
    expect(detectAlreadyGaveBoth(text)).toBe(true);
  });

  it.each([
    "Children's Calmora 100 mg per 5 mL, give 5 mL every 6 hours",
    "Take two tablets twice a day",
    "NyQuil caplets, 325 mg acetaminophen",
    "",
  ])("does not flag %s", (text) => {
    expect(detectAlreadyGaveBoth(text)).toBe(false);
  });
});

describe("fieldsFromDescription", () => {
  it("builds an all-unknown entry with the user's words as evidence and one blank ingredient row", () => {
    const f = fieldsFromDescription("the red bottle from the pharmacy");
    expect(f.productName).toEqual({
      aiValue: null,
      value: null,
      state: "unknown",
      evidence: { kind: "quote", text: "the red bottle from the pharmacy" },
    });
    expect(f.ingredients).toHaveLength(1);
    expect(f.ingredients[0].strength.state).toBe("unknown");
  });
});
