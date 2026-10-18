import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  boxToBBox,
  EXTRACTION_INSTRUCTIONS,
  geminiLabelSchema,
  toDocumentDetails,
  toEntryFields,
  toExtractionResult,
  type GeminiLabel,
  type GeminiMedication,
} from "./extract-label";

const DOC = "doc-1";
const noBox = { box_2d: null };

function medication(overrides: Partial<GeminiMedication> = {}): GeminiMedication {
  return {
    productName: { value: "Calmora Fever Relief", box_2d: [100, 200, 150, 800] },
    dosageForm: { value: "liquid", box_2d: null },
    ingredients: [
      {
        name: { value: "Acetaminophen", box_2d: [300, 100, 340, 500] },
        strength: { amount: 100, unit: "mg", perAmount: 5, perUnit: "mL", box_2d: [300, 500, 340, 900] },
      },
    ],
    instructions: { value: "give 5 mL every 6 hours", box_2d: [500, 0, 600, 1000] },
    doseAsWritten: { amount: 5, unit: "mL", box_2d: [500, 0, 600, 300] },
    max24h: { value: "do not give more than 5 times in 24 hours", box_2d: [650, 0, 700, 1000] },
    ...overrides,
  };
}

describe("boxToBBox", () => {
  it("converts Gemini [ymin, xmin, ymax, xmax] on 0-1000 to normalized {x, y, w, h}", () => {
    const b = boxToBBox([100, 200, 150, 800]);
    expect(b).not.toBeNull();
    expect(b!.x).toBeCloseTo(0.2);
    expect(b!.y).toBeCloseTo(0.1);
    expect(b!.w).toBeCloseTo(0.6);
    expect(b!.h).toBeCloseTo(0.05);
  });

  it("clamps values outside 0-1000", () => {
    const b = boxToBBox([-50, -10, 1200, 1100]);
    expect(b).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it("orders reversed corners", () => {
    const b = boxToBBox([150, 800, 100, 200]);
    expect(b!.x).toBeCloseTo(0.2);
    expect(b!.y).toBeCloseTo(0.1);
    expect(b!.w).toBeCloseTo(0.6);
    expect(b!.h).toBeCloseTo(0.05);
  });

  it("returns null for missing, wrong-length, non-finite or empty boxes", () => {
    expect(boxToBBox(null)).toBeNull();
    expect(boxToBBox(undefined)).toBeNull();
    expect(boxToBBox([1, 2, 3])).toBeNull();
    expect(boxToBBox([0, 0, Number.NaN, 10])).toBeNull();
    expect(boxToBBox([100, 100, 100, 500])).toBeNull();
  });
});

describe("toEntryFields", () => {
  it("makes every non-null value pending with a crop of its own box", () => {
    const f = toEntryFields(medication(), DOC);
    expect(f.productName).toMatchObject({ aiValue: "Calmora Fever Relief", value: "Calmora Fever Relief", state: "pending" });
    expect(f.productName.evidence).toMatchObject({ kind: "crop", sourceDocumentId: DOC });
    if (f.productName.evidence.kind !== "crop") throw new Error("expected crop");
    expect(f.productName.evidence.bbox.x).toBeCloseTo(0.2);
    expect(f.ingredients).toHaveLength(1);
    expect(f.ingredients[0].name.state).toBe("pending");
    expect(f.ingredients[0].strength.value).toEqual({ amount: 100, unit: "mg", perAmount: 5, perUnit: "mL" });
    expect(f.ingredients[0].strength.state).toBe("pending");
    expect(f.instructions.value).toBe("give 5 mL every 6 hours");
    expect(f.doseAsWritten.value).toEqual({ amount: 5, unit: "mL" });
    expect(f.max24h.state).toBe("pending");
  });

  it("uses whole-photo evidence when there is no box", () => {
    const f = toEntryFields(medication(), DOC);
    expect(f.dosageForm.evidence).toEqual({ kind: "photo", sourceDocumentId: DOC });
    expect(f.dosageForm.state).toBe("pending");
  });

  it("turns null values into unknown fields (never a guess)", () => {
    const f = toEntryFields(
      medication({
        productName: { value: null, box_2d: null },
        max24h: { value: "   ", box_2d: null },
        doseAsWritten: { amount: null, unit: "mL", box_2d: null },
      }),
      DOC,
    );
    expect(f.productName).toEqual({ aiValue: null, value: null, state: "unknown", evidence: { kind: "photo", sourceDocumentId: DOC } });
    expect(f.max24h.state).toBe("unknown");
    expect(f.doseAsWritten.state).toBe("unknown");
  });

  it("marks a strength unknown when the amount or unit is unusable", () => {
    const f = toEntryFields(
      medication({
        ingredients: [
          { name: { value: "Acetaminophen", ...noBox }, strength: { amount: null, unit: "mg", perAmount: 5, perUnit: "mL", ...noBox } },
          { name: { value: "Dextromethorphan", ...noBox }, strength: { amount: 10, unit: "furlongs", perAmount: null, perUnit: null, ...noBox } },
          { name: { value: "Doxylamine", ...noBox }, strength: { amount: -1, unit: "mg", perAmount: null, perUnit: null, ...noBox } },
        ],
      }),
      DOC,
    );
    expect(f.ingredients.map((i) => i.strength.state)).toEqual(["unknown", "unknown", "unknown"]);
    expect(f.ingredients.map((i) => i.name.state)).toEqual(["pending", "pending", "pending"]);
  });

  it("normalizes unit spelling without changing any number", () => {
    const f = toEntryFields(
      medication({
        ingredients: [
          {
            name: { value: "Acetaminophen", ...noBox },
            strength: { amount: 160, unit: "MG", perAmount: 5, perUnit: "ml", ...noBox },
          },
          {
            name: { value: "Acetaminophen", ...noBox },
            strength: { amount: 325, unit: "mg", perAmount: null, perUnit: " caplet ", ...noBox },
          },
        ],
      }),
      DOC,
    );
    expect(f.ingredients[0].strength.value).toEqual({ amount: 160, unit: "mg", perAmount: 5, perUnit: "mL" });
    expect(f.ingredients[1].strength.value).toEqual({ amount: 325, unit: "mg", perAmount: null, perUnit: "caplet" });
  });

  it("keeps the dose unit as written", () => {
    const f = toEntryFields(medication({ doseAsWritten: { amount: 2, unit: " tsp ", box_2d: null } }), DOC);
    expect(f.doseAsWritten.value).toEqual({ amount: 2, unit: "tsp" });
  });

  it("drops ingredient rows with neither a name nor a strength", () => {
    const f = toEntryFields(
      medication({
        ingredients: [
          { name: { value: null, ...noBox }, strength: { amount: null, unit: null, perAmount: null, perUnit: null, ...noBox } },
        ],
      }),
      DOC,
    );
    expect(f.ingredients).toEqual([]);
  });
});

describe("toDocumentDetails", () => {
  it("keeps ISO dates and trimmed text, nulls the rest", () => {
    expect(
      toDocumentDetails({ documentDate: "2026-10-16", facility: " Lakeside Children's Hospital ", prescriber: "", pharmacy: null }),
    ).toEqual({ documentDate: "2026-10-16", facility: "Lakeside Children's Hospital", prescriber: null, pharmacy: null });
  });

  it("rejects dates that are not valid YYYY-MM-DD", () => {
    expect(toDocumentDetails({ documentDate: "10/16/2026", facility: null, prescriber: null, pharmacy: null }).documentDate).toBeNull();
    expect(toDocumentDetails({ documentDate: "2026-02-31", facility: null, prescriber: null, pharmacy: null }).documentDate).toBeNull();
  });
});

describe("what Gemini is asked for", () => {
  const label = (documentKind: unknown) => ({
    documentKind,
    document: { documentDate: null, facility: null, prescriber: null, pharmacy: null },
    medications: [medication()],
  });

  it("Gemini says what the photo shows: a package, a prescription label, a discharge list, or null when unsure", () => {
    for (const kind of ["otc_package", "prescription_label", "discharge_list", null]) {
      expect(geminiLabelSchema.safeParse(label(kind)).success).toBe(true);
    }
    expect(geminiLabelSchema.safeParse(label("description")).success).toBe(false);
    expect(geminiLabelSchema.safeParse(label("drug_facts_photo")).success).toBe(false);
  });

  it("the prompt describes each kind, null when unsure", () => {
    expect(EXTRACTION_INSTRUCTIONS).toMatch(/otc_package/);
    expect(EXTRACTION_INSTRUCTIONS).toMatch(/prescription_label/);
    expect(EXTRACTION_INSTRUCTIONS).toMatch(/discharge_list/);
    expect(EXTRACTION_INSTRUCTIONS).toMatch(/null if you are not sure/i);
  });

  it("the prompt asks for every distinct product on a package photo, each product once", () => {
    expect(EXTRACTION_INSTRUCTIONS).toMatch(/every distinct product/i);
    expect(EXTRACTION_INSTRUCTIONS).toMatch(/several sides .* return it once/i);
  });

  it("keeps the verbatim, no-inference rules", () => {
    expect(EXTRACTION_INSTRUCTIONS).toMatch(/exactly as printed/);
    expect(EXTRACTION_INSTRUCTIONS).toMatch(/Never infer, guess, convert, round or calculate/);
    expect(EXTRACTION_INSTRUCTIONS).toMatch(/return null/);
    expect(EXTRACTION_INSTRUCTIONS).toMatch(/box_2d/);
  });
});

describe("toExtractionResult", () => {
  const read = (overrides: Partial<GeminiLabel> = {}): GeminiLabel => ({
    documentKind: "prescription_label",
    document: { documentDate: "2026-10-16", facility: null, prescriber: " Dr. Rivera ", pharmacy: null },
    medications: [medication(), medication({ productName: { value: "Calmora Night", box_2d: null } })],
    ...overrides,
  });

  it("carries Gemini's kind, the document details and one EntryFields per medication", () => {
    const r = toExtractionResult(read(), DOC);
    expect(r.documentKind).toBe("prescription_label");
    expect(r.document).toEqual({ documentDate: "2026-10-16", facility: null, prescriber: "Dr. Rivera", pharmacy: null });
    expect(r.medications.map((m) => m.productName.value)).toEqual(["Calmora Fever Relief", "Calmora Night"]);
    expect(r.medications[0].productName.evidence).toMatchObject({ sourceDocumentId: DOC });
  });

  it("keeps an unsure kind as null (the caller decides the default)", () => {
    expect(toExtractionResult(read({ documentKind: null }), DOC).documentKind).toBeNull();
  });

  it("keeps each medication's printed codes, trimmed, in medication order", () => {
    const r = toExtractionResult(
      read({ medications: [medication({ codes: [" NDC 50580-449-10 ", "", "3 00450 44910 8"] }), medication({ codes: null })] }),
      DOC,
    );
    expect(r.productCodes).toEqual([["NDC 50580-449-10", "3 00450 44910 8"], []]);
  });

  it("carries Gemini's photo issue, and null when it named none or left it out", () => {
    expect(toExtractionResult(read({ photoIssue: "glare" }), DOC).photoIssue).toBe("glare");
    expect(toExtractionResult(read({ photoIssue: null }), DOC).photoIssue).toBeNull();
    expect(toExtractionResult(read(), DOC).photoIssue).toBeNull();
  });
});
