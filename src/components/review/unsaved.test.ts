import { describe, expect, it } from "vitest";
import { emptyEntryFields, suggestedField } from "@/lib/domain/fields";
import { markMatches } from "./field-actions";
import { hasUnsavedChanges } from "./unsaved";

const photo = { kind: "photo", sourceDocumentId: "d" } as const;
const fields = { ...emptyEntryFields(), productName: suggestedField("Tylenol", photo) };
const doc = { documentDate: null, facility: null, prescriber: null, pharmacy: null };

describe("hasUnsavedChanges", () => {
  it("is false for what the page loaded with", () => {
    expect(hasUnsavedChanges({ fields, document: doc }, { fields: structuredClone(fields), document: { ...doc } })).toBe(false);
  });

  it("is true once a value has a decision", () => {
    const decided = { ...fields, productName: markMatches(fields.productName) };
    expect(hasUnsavedChanges({ fields, document: doc }, { fields: decided, document: doc })).toBe(true);
  });

  it("is true once a document detail is typed", () => {
    expect(hasUnsavedChanges({ fields, document: doc }, { fields, document: { ...doc, pharmacy: "Main St" } })).toBe(true);
  });

  it("is true once an ingredient row is added", () => {
    const added = { ...fields, ingredients: [...fields.ingredients, fields.ingredients[0]] };
    expect(hasUnsavedChanges({ fields, document: null }, { fields: added, document: null })).toBe(true);
  });
});
