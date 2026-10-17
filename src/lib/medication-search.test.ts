import { describe, expect, it } from "vitest";
import { emptyEntryFields, suggestedField } from "@/lib/domain/fields";
import type { MedicationEntry, SourceDocument } from "@/lib/domain/schema";
import { groupBySource, matchesQuery } from "./medication-search";

const doc = (id: string, extra: Partial<SourceDocument> = {}): SourceDocument => ({
  id,
  patientId: "p",
  kind: "prescription_label",
  photoPath: null,
  transcriptText: null,
  documentDate: null,
  facility: null,
  prescriber: null,
  pharmacy: null,
  createdAt: "2026-10-17T00:00:00Z",
  ...extra,
});

const entry = (id: string, name: string, sourceDocument: SourceDocument | null, ingredient = "Acetaminophen"): MedicationEntry => {
  const fields = emptyEntryFields();
  fields.productName = { ...suggestedField(name, { kind: "none" }), state: "confirmed" };
  fields.ingredients = [
    {
      name: { ...suggestedField(ingredient, { kind: "none" }), state: "confirmed" },
      strength: suggestedField(null, { kind: "none" }),
    },
  ];
  return {
    id,
    patientId: "p",
    sourceDocument,
    formulationId: null,
    inputMethod: "photo",
    status: "confirmed",
    fields,
    createdAt: "2026-10-17T00:00:00Z",
    confirmedAt: null,
  };
};

describe("matchesQuery", () => {
  const e = entry("1", "Calmora Fever Relief", doc("d", { pharmacy: "Riverside Community Pharmacy", prescriber: "Dr. Jordan Lee" }));
  it("matches product, ingredient, pharmacy and prescriber, case-insensitively", () => {
    expect(matchesQuery(e, "calmora")).toBe(true);
    expect(matchesQuery(e, "ACETAMIN")).toBe(true);
    expect(matchesQuery(e, "riverside")).toBe(true);
    expect(matchesQuery(e, "jordan")).toBe(true);
    expect(matchesQuery(e, "ibuprofen")).toBe(false);
  });
  it("matches everything for an empty query", () => {
    expect(matchesQuery(e, "   ")).toBe(true);
  });
});

describe("groupBySource", () => {
  it("keeps entries from the same document together, in first-seen order", () => {
    const d1 = doc("d1");
    const d2 = doc("d2");
    const groups = groupBySource([entry("a", "A", d1), entry("b", "B", d2), entry("c", "C", d1), entry("d", "D", null)]);
    expect(groups.map((g) => [g.document?.id ?? null, g.entries.map((e) => e.id)])).toEqual([
      ["d1", ["a", "c"]],
      ["d2", ["b"]],
      [null, ["d"]],
    ]);
  });
});
