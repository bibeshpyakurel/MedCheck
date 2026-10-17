import { describe, expect, it } from "vitest";
import { emptyEntryFields } from "@/lib/domain/fields";
import type { EntryFields, Evidence, Field } from "@/lib/domain/schema";
import { reviewStatusMessage } from "./review-status";

const photo: Evidence = { kind: "photo", sourceDocumentId: "d" };
const confirmed = <T,>(v: T): Field<T> => ({ aiValue: v, value: v, state: "confirmed", evidence: photo });
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

describe("reviewStatusMessage", () => {
  it("counts values still waiting for the user", () => {
    expect(reviewStatusMessage(fields({ productName: pending("Calmora") }))).toBe("1 value needs Matches, Edit or Can't tell.");
    expect(reviewStatusMessage(fields({ productName: pending("x"), dosageForm: pending("y") }))).toBe(
      "2 values need Matches, Edit or Can't tell.",
    );
  });

  it("never says everything was checked", () => {
    expect(reviewStatusMessage(fields({}))).toBe("You've gone through every field.");
  });

  it("says how many values are unknown and that checks needing them stay unresolved", () => {
    expect(reviewStatusMessage(fields({ max24h: cantTell("x") }))).toBe(
      "You've gone through every field. 1 you couldn't tell — checks that need it will stay unresolved.",
    );
    expect(
      reviewStatusMessage(
        fields({
          max24h: cantTell(null),
          ingredients: [{ name: confirmed("Acetaminophen"), strength: cantTell(null) }],
        }),
      ),
    ).toBe("You've gone through every field. 2 you couldn't tell — checks that need them will stay unresolved.");
  });

  it("doesn't count values the source never had (a catalog label with no written dose)", () => {
    expect(reviewStatusMessage(fields({ doseAsWritten: emptyEntryFields().doseAsWritten }))).toBe("You've gone through every field.");
  });
});
