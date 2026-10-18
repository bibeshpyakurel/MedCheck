// The shared MedCheck contract. Every feature (capture, review, checks, records, export)
// reads and writes these shapes. `EntryFields` is what lives in `medication_entries.fields`.
// Change this file only in a dedicated PR — parallel work depends on it.
import { z } from "zod";

// ---------------------------------------------------------------------------
// Evidence: where a value came from. Every confirmed value points at one.
// ---------------------------------------------------------------------------

/** Normalized bounding box on a photo, all values 0..1 relative to image width/height. */
export const bboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});
export type BBox = z.infer<typeof bboxSchema>;

export const evidenceSchema = z.discriminatedUnion("kind", [
  // A crop of a photo (label, prescription, discharge list).
  z.object({ kind: z.literal("crop"), sourceDocumentId: z.string(), bbox: bboxSchema }),
  // The whole photo — used when the AI returned no usable box.
  z.object({ kind: z.literal("photo"), sourceDocumentId: z.string() }),
  // Words: the user's own description, or verbatim label text.
  z.object({ kind: z.literal("quote"), text: z.string(), sourceDocumentId: z.string().optional() }),
  // The FDA label in our catalog (barcode or picker).
  z.object({ kind: z.literal("database"), formulationId: z.string(), text: z.string().optional() }),
  z.object({ kind: z.literal("none") }),
]);
export type Evidence = z.infer<typeof evidenceSchema>;

// ---------------------------------------------------------------------------
// Fields: an AI (or catalog) suggestion plus what the user did with it.
// ---------------------------------------------------------------------------

/**
 * pending   — suggested, user hasn't acted yet (never counts as confirmed)
 * confirmed — user said it matches
 * edited    — user corrected it (value differs from aiValue)
 * unknown   — user couldn't tell, or nothing was found; checks needing it are unresolved
 */
export const fieldStateSchema = z.enum(["pending", "confirmed", "edited", "unknown"]);
export type FieldState = z.infer<typeof fieldStateSchema>;

export function fieldSchema<T extends z.ZodType>(value: T) {
  return z.object({
    aiValue: value.nullable(),
    value: value.nullable(),
    state: fieldStateSchema,
    evidence: evidenceSchema,
  });
}
export type Field<T> = {
  aiValue: T | null;
  value: T | null;
  state: FieldState;
  evidence: Evidence;
};

/** Mass/amount units and volume units as printed on labels. */
export const amountUnitSchema = z.enum(["mg", "mcg", "g", "mL", "L", "tsp", "tbsp", "unit"]);
export type AmountUnit = z.infer<typeof amountUnitSchema>;

/**
 * Strength as printed. "100 mg per 5 mL" → { amount: 100, unit: "mg", perAmount: 5, perUnit: "mL" }.
 * "325 mg (in each caplet)" → { amount: 325, unit: "mg", perAmount: 1, perUnit: "caplet" }.
 */
export const strengthSchema = z.object({
  amount: z.number().positive(),
  unit: amountUnitSchema,
  perAmount: z.number().positive().nullable(),
  perUnit: z.string().nullable(),
});
export type Strength = z.infer<typeof strengthSchema>;

/** The amount the instructions tell you to take/give, exactly as written: "5 mL", "1 tsp", "2 caplets". */
export const doseAsWrittenSchema = z.object({
  amount: z.number().positive(),
  unit: z.string().min(1),
});
export type DoseAsWritten = z.infer<typeof doseAsWrittenSchema>;

export const ingredientFieldsSchema = z.object({
  name: fieldSchema(z.string().min(1)),
  strength: fieldSchema(strengthSchema),
});
export type IngredientFields = z.infer<typeof ingredientFieldsSchema>;

export const entryFieldsSchema = z.object({
  productName: fieldSchema(z.string().min(1)),
  dosageForm: fieldSchema(z.string().min(1)), // "liquid", "caplet", "tablet", …
  ingredients: z.array(ingredientFieldsSchema),
  instructions: fieldSchema(z.string().min(1)), // verbatim directions text
  doseAsWritten: fieldSchema(doseAsWrittenSchema), // parsed from the instructions, never computed
  max24h: fieldSchema(z.string().min(1)), // verbatim, e.g. "do not give more than 5 times in 24 hours"
});
export type EntryFields = z.infer<typeof entryFieldsSchema>;

// ---------------------------------------------------------------------------
// Rows the app works with (camelCase views over the DB rows).
// ---------------------------------------------------------------------------

export const sourceDocumentKindSchema = z.enum([
  "otc_package",
  "drug_facts_photo",
  "prescription_label",
  "discharge_list",
  "description",
]);
export type SourceDocumentKind = z.infer<typeof sourceDocumentKindSchema>;

export const inputMethodSchema = z.enum(["barcode", "photo", "voice", "typed", "picker"]);
export type InputMethod = z.infer<typeof inputMethodSchema>;

export type SourceDocument = {
  id: string;
  patientId: string;
  kind: SourceDocumentKind;
  photoPath: string | null;
  transcriptText: string | null;
  documentDate: string | null; // ISO date
  facility: string | null;
  prescriber: string | null;
  pharmacy: string | null;
  createdAt: string;
};

export type MedicationEntry = {
  id: string;
  patientId: string;
  sourceDocument: SourceDocument | null;
  formulationId: string | null;
  inputMethod: InputMethod;
  status: "draft" | "confirmed";
  fields: EntryFields;
  createdAt: string;
  confirmedAt: string | null;
};

export const catalogIngredientSchema = z.object({
  name: z.string(), // as printed, e.g. "Acetaminophen"
  normalized: z.string(), // canonical, e.g. "acetaminophen"
  strength: strengthSchema,
});
export type CatalogIngredient = z.infer<typeof catalogIngredientSchema>;

/**
 * Drug Facts sections the medicine card shows, in card order. Each holds the label's own text split
 * into short bullets (cleaned of repeated headings and bullet glyphs, never reworded).
 */
export const LABEL_SECTION_KEYS = [
  "uses",
  "purpose",
  "directions",
  "do_not_use",
  "ask_doctor",
  "ask_doctor_or_pharmacist",
  "when_using",
  "stop_use",
  "pregnancy_or_breast_feeding",
  "warnings", // general warnings not under a named heading (liver, allergy alert, sore throat, …)
  "keep_out_of_reach",
  "inactive_ingredients",
  "storage",
  "other_information", // the label's "Other information" beyond storage (sodium content, tamper seals, allergens)
  "questions", // "Questions or comments?" — the maker's phone line
] as const;
export const labelSectionKeySchema = z.enum(LABEL_SECTION_KEYS);
export type LabelSectionKey = z.infer<typeof labelSectionKeySchema>;

export const labelSectionsSchema = z.partialRecord(labelSectionKeySchema, z.array(z.string().min(1)));
export type LabelSections = z.infer<typeof labelSectionsSchema>;

/** A source the card cites: the FDA label itself, MedlinePlus for an ingredient. */
export const sourceLinkSchema = z.object({ label: z.string().min(1), url: z.url() });
export type SourceLink = z.infer<typeof sourceLinkSchema>;

export type Formulation = {
  id: string;
  slug: string;
  brandName: string;
  genericName: string;
  dosageForm: string;
  isFictional: boolean;
  ndcPackages: string[]; // 11-digit, no hyphens
  activeIngredients: CatalogIngredient[];
  directionsText: string | null;
  max24hText: string | null;
  warningsQuotes: string[];
  dosageTableHtml: string | null;
  source: "openfda" | "fictional";
  openfdaSetId: string | null;
  labelEffectiveDate: string | null;
  labelerName: string | null; // the company on the label, e.g. "Johnson & Johnson Consumer Inc."
  labelSections: LabelSections;
  sourceLinks: SourceLink[];
  /** Hand-checked. Imported rows are not; the card says so. */
  reviewed: boolean;
};

// ---------------------------------------------------------------------------
// Checks and findings. Produced by pure functions in src/lib/checks.
// ---------------------------------------------------------------------------

export const CHECK_IDS = [
  "ingredient_overlap",
  "ingredient_family", // different ingredients in one reviewed family (two NSAIDs), named by a label's own warning
  "repeated_record",
  "concentration",
  "units",
  "document_vs_bottle",
  "database_vs_box",
] as const;
export type CheckId = (typeof CHECK_IDS)[number];

/**
 * finding        — something to bring to a pharmacist
 * no_finding     — ran on confirmed fields, nothing found. NEVER display as "safe".
 * unresolved     — couldn't complete because a needed field is unknown/pending
 * not_applicable — nothing to compare (e.g. only one liquid on file)
 */
export type CheckStatus = "finding" | "no_finding" | "unresolved" | "not_applicable";

export type FindingEvidence = {
  entryId: string;
  entryLabel: string; // product name as confirmed, or "Unnamed medicine"
  field: string; // e.g. "ingredients[0].strength", "instructions"
  text: string; // human-readable value, e.g. "100 mg per 5 mL"
  evidence: Evidence;
  documentKind: SourceDocumentKind | null;
  documentDate: string | null;
};

export type Finding = {
  id: string; // deterministic: `${check}:${sorted entry ids}:${discriminator}`
  check: CheckId;
  title: string;
  detail: string;
  entryIds: string[];
  evidence: FindingEvidence[];
  labelWarningQuote: string | null; // verbatim label warning, e.g. "do not use with other drugs containing acetaminophen"
  pharmacistQuestion: string;
};

export type CheckRun = {
  check: CheckId;
  status: CheckStatus;
  summary: string; // one line for the "Checks run" panel
  reasons: string[]; // why unresolved / not applicable
  findings: Finding[];
};

export type CheckInput = {
  entries: MedicationEntry[]; // only status === "confirmed" entries are considered
  formulations: Record<string, Formulation>; // by id
};
