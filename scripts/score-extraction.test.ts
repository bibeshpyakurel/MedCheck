import { describe, expect, it } from "vitest";
import { entryFieldsSchema, type EntryFields } from "@/lib/domain/schema";
import { suggestedField } from "@/lib/domain/fields";
import { DISCHARGE_LIST, DRUG_FACTS_LABELS, PRESCRIPTION_LABEL } from "@/data/demo-documents";
import bottleA from "../demo-assets/expected/bottle-a.json";
import bottleB from "../demo-assets/expected/bottle-b.json";
import dischargeList from "../demo-assets/expected/discharge-list.json";
import prescriptionLabel from "../demo-assets/expected/prescription-label.json";
import {
  accuracy,
  expectedExtractionSchema,
  formatTable,
  scoreExtraction,
  toEntryFields,
  type ExpectedExtraction,
  type ExtractionLike,
} from "./score-extraction";

const EXPECTED_FILES = {
  "bottle-a": bottleA,
  "bottle-b": bottleB,
  "prescription-label": prescriptionLabel,
  "discharge-list": dischargeList,
};

const parse = (raw: unknown) => expectedExtractionSchema.parse(raw);

/** What a perfect extraction looks like coming out of extractFromPhoto(): every value suggested (`pending`). */
function perfectActual(e: ExpectedExtraction): ExtractionLike {
  return {
    document: { ...e.document },
    medications: e.medications.map((m) => {
      const ev = { kind: "photo", sourceDocumentId: "doc-1" } as const;
      return {
        productName: suggestedField(m.productName, ev),
        dosageForm: suggestedField(m.dosageForm, ev),
        ingredients: m.ingredients.map((i) => ({ name: suggestedField(i.name, ev), strength: suggestedField(i.strength, ev) })),
        instructions: suggestedField(m.instructions, ev),
        doseAsWritten: suggestedField(m.doseAsWritten, ev),
        max24h: suggestedField(m.max24h, ev),
      } satisfies EntryFields;
    }),
  };
}

const rx = () => parse(prescriptionLabel);

describe("expected-values files", () => {
  it.each(Object.entries(EXPECTED_FILES))("%s parses and its medications are valid EntryFields", (item, raw) => {
    const e = parse(raw);
    expect(e.item).toBe(item);
    for (const m of e.medications) expect(() => entryFieldsSchema.parse(toEntryFields(m))).not.toThrow();
  });

  it("Bottle A and B match the fictional catalog and the printed Drug Facts", () => {
    for (const label of DRUG_FACTS_LABELS) {
      const e = parse(EXPECTED_FILES[label.id]);
      const f = label.formulation;
      expect(e.kind).toBe("drug_facts_photo");
      expect(e.medications).toHaveLength(1);
      const [m] = e.medications;
      expect(m.productName).toBe(f.brandName);
      expect(m.dosageForm).toBe(f.dosageForm);
      expect(m.ingredients).toEqual(f.activeIngredients.map((i) => ({ name: i.name, strength: i.strength })));
      expect(m.instructions).toBe(f.directionsText);
      expect(m.max24h).toBe(f.max24hText);
    }
  });

  it("prescription label matches the printed sheet", () => {
    const e = rx();
    expect(e.document).toEqual({
      documentDate: PRESCRIPTION_LABEL.dateFilled,
      facility: null,
      prescriber: PRESCRIPTION_LABEL.prescriber,
      pharmacy: PRESCRIPTION_LABEL.pharmacy,
    });
    expect(e.medications[0].instructions).toBe(PRESCRIPTION_LABEL.directions);
    expect(e.medications[0].doseAsWritten).toEqual({ amount: 2, unit: "tsp" });
    expect(e.medications[0].ingredients[0].strength).toEqual({ amount: 160, unit: "mg", perAmount: 5, perUnit: "mL" });
  });

  it("discharge list matches the printed sheet and has one non-acetaminophen line", () => {
    const e = parse(dischargeList);
    expect(e.document.facility).toBe(DISCHARGE_LIST.facility);
    expect(e.document.documentDate).toBe(DISCHARGE_LIST.date);
    expect(e.medications.map((m) => m.instructions)).toEqual(DISCHARGE_LIST.medications.map((m) => m.directions));
    expect(e.medications.map((m) => m.ingredients[0].name)).toEqual(["Acetaminophen", "Ondansetron"]);
  });
});

describe("scoreExtraction", () => {
  it("scores a perfect extraction 100% with one row per field", () => {
    const e = rx();
    const scores = scoreExtraction(e, perfectActual(e));
    expect(scores.every((s) => s.match)).toBe(true);
    expect(scores.map((s) => s.field)).toEqual([
      "document.documentDate",
      "document.facility",
      "document.prescriber",
      "document.pharmacy",
      "medications.count",
      "medications[0].productName",
      "medications[0].dosageForm",
      "medications[0].ingredients[0].name",
      "medications[0].ingredients[0].strength",
      "medications[0].instructions",
      "medications[0].doseAsWritten",
      "medications[0].max24h",
    ]);
    expect(accuracy(scores)).toBe(100);
  });

  it("ignores case, repeated whitespace and trailing punctuation in text", () => {
    const e = rx();
    const actual = perfectActual(e);
    actual.document.pharmacy = "  riverside   COMMUNITY pharmacy ";
    actual.medications[0].instructions = suggestedField("give 2 TSP by mouth\nevery 6 hours as needed for fever.", { kind: "none" });
    actual.medications[0].ingredients[0].strength = suggestedField(
      { amount: 160, unit: "mg", perAmount: 5, perUnit: "ml" },
      { kind: "none" },
    );
    expect(scoreExtraction(e, actual).every((s) => s.match)).toBe(true);
  });

  it("requires numbers to match exactly", () => {
    const e = rx();
    const actual = perfectActual(e);
    actual.medications[0].ingredients[0].strength = suggestedField(
      { amount: 100, unit: "mg", perAmount: 5, perUnit: "mL" },
      { kind: "none" },
    );
    actual.medications[0].doseAsWritten = suggestedField({ amount: 2.5, unit: "tsp" }, { kind: "none" });
    const failed = scoreExtraction(e, actual).filter((s) => !s.match).map((s) => s.field);
    expect(failed).toEqual(["medications[0].ingredients[0].strength", "medications[0].doseAsWritten"]);
  });

  it("treats a per-amount of 1 and a missing per-amount as the same strength", () => {
    const e = parse(dischargeList);
    const actual = perfectActual(e);
    const s = e.medications[1].ingredients[0].strength!;
    actual.medications[1].ingredients[0].strength = suggestedField({ ...s, perAmount: null }, { kind: "none" });
    expect(scoreExtraction(e, actual).every((r) => r.match)).toBe(true);
  });

  it("expected null matches only an actual null", () => {
    const e = rx();
    const actual = perfectActual(e);
    actual.document.facility = "Riverside";
    actual.medications[0].max24h = suggestedField("Do not exceed 5 doses", { kind: "none" });
    const failed = scoreExtraction(e, actual).filter((s) => !s.match).map((s) => s.field);
    expect(failed).toEqual(["document.facility", "medications[0].max24h"]);
  });

  it("pairs medications by ingredient, not order, and fails every field of a missing one", () => {
    const e = parse(dischargeList);
    const actual = perfectActual(e);
    actual.medications.reverse();
    expect(scoreExtraction(e, actual).every((r) => r.match)).toBe(true);

    actual.medications = actual.medications.filter((m) => m.ingredients[0].name.value === "Acetaminophen");
    const failed = scoreExtraction(e, actual).filter((r) => !r.match).map((r) => r.field);
    expect(failed).toContain("medications.count");
    expect(failed).toContain("medications[1].productName");
    expect(failed).toContain("medications[1].ingredients[0].strength");
    expect(failed.some((f) => f.startsWith("medications[0]"))).toBe(false);
  });

  it("scores the confirmed value when present, else the AI suggestion", () => {
    const e = rx();
    const actual = perfectActual(e);
    actual.medications[0].productName = { aiValue: e.medications[0].productName, value: null, state: "unknown", evidence: { kind: "none" } };
    expect(scoreExtraction(e, actual).find((s) => s.field === "medications[0].productName")?.match).toBe(true);
  });

  it("formats a table with an accuracy line", () => {
    const e = rx();
    const table = formatTable(scoreExtraction(e, perfectActual(e)));
    expect(table).toContain("medications[0].doseAsWritten");
    expect(table).toContain("2 tsp");
    expect(table).toMatch(/12\/12 fields match \(100%\)/);
  });
});
