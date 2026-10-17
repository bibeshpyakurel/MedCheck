// Photo → EntryFields. `extractFromPhoto` calls Gemini; everything else here is pure and tested.
import { generateText, Output } from "ai";
import { z } from "zod";
import type { BBox, EntryFields, Evidence, SourceDocument, SourceDocumentKind } from "@/lib/domain/schema";
import { withGemini } from "./model";
import { buildEntryFields, cleanText } from "./raw-fields";

// ---------------------------------------------------------------------------
// What we ask Gemini for
// ---------------------------------------------------------------------------

const box = z
  .array(z.number())
  .nullable()
  .describe("Bounding box of the printed text as [ymin, xmin, ymax, xmax], each 0-1000 relative to the image. null if not visible.");
const text = (what: string) =>
  z.object({ value: z.string().nullable().describe(`${what}, exactly as printed. null if not printed or unreadable.`), box_2d: box });

const geminiMedicationSchema = z.object({
  productName: text("Product or medicine name (brand or generic as printed)"),
  dosageForm: text("Dosage form as printed, e.g. liquid, oral suspension, caplet, tablet, capsule"),
  ingredients: z
    .array(
      z.object({
        name: text("Active ingredient name"),
        strength: z.object({
          amount: z.number().nullable().describe("Printed amount, e.g. 160 in '160 mg per 5 mL'"),
          unit: z.string().nullable().describe("Printed unit of the amount: mg, mcg, g, mL, L, tsp, tbsp or unit"),
          perAmount: z.number().nullable().describe("Printed 'per' amount, e.g. 5 in '160 mg per 5 mL'; 1 for 'in each caplet'; null if none"),
          perUnit: z.string().nullable().describe("Printed 'per' unit, e.g. mL, caplet, tablet; null if none"),
          box_2d: box,
        }),
      }),
    )
    .describe("Each active ingredient with its strength as printed"),
  instructions: text("The directions / instructions text, verbatim"),
  doseAsWritten: z.object({
    amount: z.number().nullable().describe("The amount the directions say to take or give, e.g. 2 in 'give 2 tsp'"),
    unit: z.string().nullable().describe("Its unit exactly as written, e.g. tsp, mL, caplets"),
    box_2d: box,
  }),
  max24h: text("The 24-hour maximum sentence, verbatim (e.g. 'do not give more than 5 times in 24 hours')"),
});

const geminiLabelSchema = z.object({
  document: z.object({
    documentDate: z.string().nullable().describe("Date printed on the document (fill or discharge date) as YYYY-MM-DD; null if none"),
    facility: z.string().nullable().describe("Hospital or clinic name as printed; null if none"),
    prescriber: z.string().nullable().describe("Prescriber name as printed; null if none"),
    pharmacy: z.string().nullable().describe("Pharmacy name as printed; null if none"),
  }),
  medications: z.array(geminiMedicationSchema).describe("One entry per medication on the document"),
});

export type GeminiMedication = z.infer<typeof geminiMedicationSchema>;
export type GeminiLabel = z.infer<typeof geminiLabelSchema>;

export type DocumentDetails = Pick<SourceDocument, "documentDate" | "facility" | "prescriber" | "pharmacy">;
export type ExtractionResult = { document: DocumentDetails; medications: EntryFields[] };

const KIND_HINT: Record<SourceDocumentKind, string> = {
  prescription_label: "a pharmacy prescription label (usually one medication)",
  discharge_list: "a hospital discharge medication list (may list several medications — return each one)",
  otc_package: "an over-the-counter medicine package or bottle (one product; read the Drug Facts panel if visible)",
  drug_facts_photo: "the Drug Facts panel of an over-the-counter medicine (one product)",
  description: "a medicine document",
};

const INSTRUCTIONS = `You read medicine labels and documents for a caregiver who will check every value you return.
Rules:
- Copy values exactly as printed. Never infer, guess, convert, round or calculate anything (no dose from age or weight, no unit conversion, no totals).
- If a value is not printed, cut off, blurry or you are not sure, return null for it.
- Split each strength into amount, unit, perAmount and perUnit as printed ("160 mg per 5 mL" → 160, mg, 5, mL; "325 mg in each caplet" → 325, mg, 1, caplet).
- doseAsWritten is the amount the directions say to take or give, exactly as written in the directions, with its unit as written ("2 tsp" stays 2 tsp). If the directions depend on age or weight, or there is a table, return null.
- For every value give box_2d [ymin, xmin, ymax, xmax] on a 0-1000 scale around the printed text, or null.
- Return one medications item per distinct medication. Return an empty list if no medication is visible.`;

// ---------------------------------------------------------------------------
// Pure mappers
// ---------------------------------------------------------------------------

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Gemini `box_2d` [ymin, xmin, ymax, xmax] on 0-1000 → normalized {x, y, w, h}; null when unusable. */
export function boxToBBox(raw: number[] | null | undefined): BBox | null {
  if (!raw || raw.length !== 4 || !raw.every(Number.isFinite)) return null;
  const [a, b, c, d] = raw.map((n) => clamp01(n / 1000));
  const y = Math.min(a, c);
  const x = Math.min(b, d);
  const h = Math.max(a, c) - y;
  const w = Math.max(b, d) - x;
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

export function toEntryFields(raw: GeminiMedication, sourceDocumentId: string): EntryFields {
  return buildEntryFields<{ box_2d: number[] | null }>(raw, ({ box_2d }): Evidence => {
    const bbox = boxToBBox(box_2d);
    return bbox ? { kind: "crop", sourceDocumentId, bbox } : { kind: "photo", sourceDocumentId };
  });
}

function isoDateOrNull(raw: string | null): string | null {
  const t = cleanText(raw);
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t ? t : null;
}

export function toDocumentDetails(raw: GeminiLabel["document"]): DocumentDetails {
  return {
    documentDate: isoDateOrNull(raw.documentDate),
    facility: cleanText(raw.facility),
    prescriber: cleanText(raw.prescriber),
    pharmacy: cleanText(raw.pharmacy),
  };
}

// ---------------------------------------------------------------------------
// Gemini call
// ---------------------------------------------------------------------------

/** Reads a label/document photo. Throws on any model or validation failure; callers fall back to manual entry. */
export async function extractFromPhoto(
  image: Uint8Array,
  mediaType: string,
  kind: SourceDocumentKind,
  sourceDocumentId = "",
): Promise<ExtractionResult> {
  const { output } = await withGemini((settings) =>
    generateText({
      ...settings,
      instructions: INSTRUCTIONS,
      output: Output.object({ schema: geminiLabelSchema }),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `This photo is ${KIND_HINT[kind]}. Extract the values as printed.` },
            { type: "file", mediaType, data: image },
          ],
        },
      ],
    }),
  );
  return {
    document: toDocumentDetails(output.document),
    medications: output.medications.map((m) => toEntryFields(m, sourceDocumentId)),
  };
}
