import { describe, expect, it } from "vitest";
import { emptyEntryFields } from "@/lib/domain/fields";
import type { EntryFields, Evidence, Field } from "@/lib/domain/schema";
import {
  confirmationSummary,
  groupFields,
  groupProgress,
  groupProgressLabel,
  reviewProgress,
  reviewStatusMessage,
} from "./review-status";

const photo: Evidence = { kind: "photo", sourceDocumentId: "d" };
const confirmed = <T,>(v: T): Field<T> => ({ aiValue: v, value: v, state: "confirmed", evidence: photo });
const edited = <T,>(ai: T, v: T): Field<T> => ({ aiValue: ai, value: v, state: "edited", evidence: photo });
const pending = <T,>(v: T): Field<T> => ({ aiValue: v, value: v, state: "pending", evidence: photo });
const cantTell = <T,>(v: T | null): Field<T> => ({ aiValue: v, value: null, state: "unknown", evidence: photo });

function fields(patch: Partial<EntryFields>): EntryFields {
  return {
    ...emptyEntryFields(),
    productName: confirmed("Calmora"),
    dosageForm: confirmed("liquid"),
    instructions: confirmed("Shake well"),
    doseAsWritten: confirmed({ amount: 5, unit: "mL" }),
    max24h: confirmed("Do not give more than 5 times in 24 hours"),
    ...patch,
  };
}

describe("groupFields", () => {
  it("splits the values into name and form, ingredients and strengths, and directions", () => {
    const f = fields({ ingredients: [{ name: confirmed("Acetaminophen"), strength: pending(null) }] });
    expect(groupFields(f, "medicine")).toEqual([f.productName, f.dosageForm]);
    expect(groupFields(f, "ingredients")).toEqual([f.ingredients[0].name, f.ingredients[0].strength]);
    expect(groupFields(f, "directions")).toEqual([f.instructions, f.doseAsWritten, f.max24h]);
  });
});

describe("groupProgress / groupProgressLabel", () => {
  it("counts decisions, including values left unknown", () => {
    const f = fields({ productName: pending("x"), dosageForm: cantTell("y") });
    expect(groupProgress(groupFields(f, "medicine"))).toEqual({ decided: 1, total: 2, pending: 1 });
    expect(groupProgressLabel(groupProgress(groupFields(f, "medicine")))).toBe("1 of 2 checked");
  });

  it("says when a group is done, and when it has nothing in it yet", () => {
    expect(groupProgressLabel(groupProgress(groupFields(fields({}), "directions")))).toBe("All checked");
    expect(groupProgressLabel(groupProgress(groupFields(fields({ ingredients: [] }), "ingredients")))).toBe("None added yet");
  });
});

describe("reviewProgress", () => {
  it("counts every value the user has decided on", () => {
    expect(reviewProgress(fields({ productName: pending("x") }))).toEqual({ reviewed: 4, total: 5 });
  });
});

describe("reviewStatusMessage", () => {
  it("counts actual decisions", () => {
    expect(reviewStatusMessage(fields({ productName: pending("x"), dosageForm: pending("y") }))).toBe("3 of 5 details checked");
  });

  it("says how many are left unknown, without calling them verified", () => {
    expect(reviewStatusMessage(fields({ productName: pending("x"), max24h: cantTell("y") }))).toBe(
      "4 of 5 details checked · 1 left unknown",
    );
  });

  it("never says everything was checked", () => {
    expect(reviewStatusMessage(fields({}))).toBe("5 of 5 details checked");
  });

  it("doesn't count a value the source never had as left unknown", () => {
    expect(reviewStatusMessage(fields({ doseAsWritten: emptyEntryFields().doseAsWritten }))).toBe("5 of 5 details checked");
  });
});

describe("confirmationSummary", () => {
  it("is null while anything is waiting for a decision", () => {
    expect(confirmationSummary(fields({ productName: pending("x") }), "label")).toBeNull();
  });

  it("states matched, changed and unknown counts", () => {
    const f = fields({
      dosageForm: edited("tablet", "caplet"),
      max24h: cantTell("x"),
      ingredients: [{ name: confirmed("Acetaminophen"), strength: confirmed({ amount: 160, unit: "mg", perAmount: 5, perUnit: "mL" }) }],
    });
    expect(confirmationSummary(f, "label")).toBe(
      "5 match the label, 1 changed, 1 left unknown — checks that need unknown details won't run.",
    );
  });

  it("uses singular verbs and leaves out empty groups", () => {
    const f = fields({
      productName: edited("a", "b"),
      dosageForm: edited("a", "b"),
      instructions: edited("a", "b"),
      doseAsWritten: edited({ amount: 1, unit: "mL" }, { amount: 2, unit: "mL" }),
    });
    expect(confirmationSummary(f, "label")).toBe("1 matches the label, 4 changed.");
  });

  it("speaks about what you said for a description", () => {
    expect(confirmationSummary(fields({}), "description")).toBe("5 match what you said.");
  });

  it("counts values the source never had separately from ones left unknown", () => {
    expect(confirmationSummary(fields({ doseAsWritten: emptyEntryFields().doseAsWritten }), "label")).toBe(
      "4 match the label, 1 not on the label.",
    );
  });
});
