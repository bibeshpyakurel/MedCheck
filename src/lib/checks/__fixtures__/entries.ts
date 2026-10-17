// Realistic test fixtures for the checks. All products here are fixtures; the NyQuil values mirror
// a real label closely enough to exercise the rules, the Calmora products are fictional.
import { FICTIONAL_FORMULATIONS } from "@/data/fictional-formulations";
import { emptyField } from "@/lib/domain/fields";
import type {
  CheckInput,
  DoseAsWritten,
  EntryFields,
  Evidence,
  Field,
  Formulation,
  InputMethod,
  MedicationEntry,
  SourceDocument,
  SourceDocumentKind,
  Strength,
} from "@/lib/domain/schema";

// ---------------------------------------------------------------------------
// Field builders
// ---------------------------------------------------------------------------

const BOX = { x: 0.1, y: 0.2, w: 0.5, h: 0.08 };

export function confirmed<T>(value: T, evidence: Evidence): Field<T> {
  return { aiValue: value, value, state: "confirmed", evidence };
}
export function edited<T>(aiValue: T | null, value: T, evidence: Evidence): Field<T> {
  return { aiValue, value, state: "edited", evidence };
}
export function pending<T>(value: T, evidence: Evidence): Field<T> {
  return { aiValue: value, value, state: "pending", evidence };
}
/** The user tapped "Can't tell" on a suggestion. */
export function cantTell<T>(aiValue: T | null, evidence: Evidence): Field<T> {
  return { aiValue, value: null, state: "unknown", evidence };
}
/** Nothing was found at all (e.g. a catalog label with no parsed dose). */
export function absent<T>(): Field<T> {
  return emptyField<T>();
}

type Spec<T> = T | Field<T> | null;

function isField<T>(v: Spec<T>): v is Field<T> {
  return typeof v === "object" && v !== null && "state" in v && "evidence" in v;
}

export const mgPer = (amount: number, perAmount: number | null, perUnit: string | null): Strength => ({
  amount,
  unit: "mg",
  perAmount,
  perUnit,
});
export const dose = (amount: number, unit: string): DoseAsWritten => ({ amount, unit });

// ---------------------------------------------------------------------------
// Entry builder
// ---------------------------------------------------------------------------

export type EntrySpec = {
  id: string;
  name: Spec<string>;
  form: Spec<string>;
  ingredients: { name: Spec<string>; strength: Spec<Strength> }[];
  instructions?: Spec<string>;
  dose?: Spec<DoseAsWritten>;
  max24h?: Spec<string>;
  doc?: { kind: SourceDocumentKind; date?: string | null } | null;
  inputMethod?: InputMethod;
  formulationId?: string | null;
  status?: "draft" | "confirmed";
  /** Evidence used for raw values. Defaults to a crop of the source document, else the catalog label. */
  evidence?: Evidence;
};

export function makeEntry(spec: EntrySpec): MedicationEntry {
  const sourceDocument: SourceDocument | null = spec.doc
    ? {
        id: `doc-${spec.id}`,
        patientId: "patient-sam",
        kind: spec.doc.kind,
        photoPath: spec.doc.kind === "description" ? null : `patient-sam/doc-${spec.id}.jpg`,
        transcriptText: null,
        documentDate: spec.doc.date ?? null,
        facility: null,
        prescriber: null,
        pharmacy: null,
        createdAt: "2026-10-17T12:00:00Z",
      }
    : null;
  const formulationId = spec.formulationId ?? null;
  const evidence: Evidence =
    spec.evidence ??
    (sourceDocument
      ? { kind: "crop", sourceDocumentId: sourceDocument.id, bbox: BOX }
      : formulationId
        ? { kind: "database", formulationId }
        : { kind: "none" });

  const field = <T,>(v: Spec<T> | undefined): Field<T> => {
    if (v === undefined) return absent<T>();
    if (v === null) return cantTell<T>(null, evidence);
    if (isField(v)) return v;
    return confirmed(v, evidence);
  };

  const fields: EntryFields = {
    productName: field(spec.name),
    dosageForm: field(spec.form),
    ingredients: spec.ingredients.map((i) => ({ name: field(i.name), strength: field(i.strength) })),
    instructions: field(spec.instructions),
    doseAsWritten: field(spec.dose),
    max24h: field(spec.max24h),
  };

  return {
    id: spec.id,
    patientId: "patient-sam",
    sourceDocument,
    formulationId,
    inputMethod: spec.inputMethod ?? "photo",
    status: spec.status ?? "confirmed",
    fields,
    createdAt: "2026-10-17T12:00:00Z",
    confirmedAt: spec.status === "draft" ? null : "2026-10-17T12:05:00Z",
  };
}

// ---------------------------------------------------------------------------
// Catalog formulations
// ---------------------------------------------------------------------------

export const NYQUIL_ID = "f-nyquil-caplet";
export const CALMORA_A_ID = "f-calmora-a";
export const CALMORA_B_ID = "f-calmora-b";

export const NYQUIL_LIVER_WARNING =
  "Liver warning: This product contains acetaminophen. Severe liver damage may occur if you take more than 4 doses in 24 hours, which is the maximum daily amount for this product, or with other drugs containing acetaminophen.";

export const nyquilFormulation: Formulation = {
  id: NYQUIL_ID,
  slug: "nyquil-cold-flu-caplet",
  brandName: "NyQuil Cold & Flu Nighttime Relief",
  genericName: "Acetaminophen, Dextromethorphan HBr, Doxylamine succinate",
  dosageForm: "caplet",
  isFictional: false,
  ndcPackages: ["37000052302"],
  activeIngredients: [
    { name: "Acetaminophen", normalized: "acetaminophen", strength: mgPer(325, 1, "caplet") },
    { name: "Dextromethorphan HBr", normalized: "dextromethorphan", strength: mgPer(15, 1, "caplet") },
    { name: "Doxylamine succinate", normalized: "doxylamine", strength: mgPer(6.25, 1, "caplet") },
  ],
  directionsText: "Adults and children 12 years and over: take 2 caplets every 6 hours.",
  max24hText: "Do not take more than 4 doses in 24 hours.",
  warningsQuotes: [
    "Do not use to sedate children.",
    NYQUIL_LIVER_WARNING,
  ],
  dosageTableHtml: null,
  source: "openfda",
  openfdaSetId: "set-nyquil",
  labelEffectiveDate: "2025-01-01",
};

const [fictionalA, fictionalB] = FICTIONAL_FORMULATIONS;
export const calmoraAFormulation: Formulation = { ...withoutKit(fictionalA), id: CALMORA_A_ID };
export const calmoraBFormulation: Formulation = { ...withoutKit(fictionalB), id: CALMORA_B_ID };

function withoutKit(f: (typeof FICTIONAL_FORMULATIONS)[number]): Omit<Formulation, "id"> {
  const { ndc10, upcA, ...rest } = f;
  void ndc10;
  void upcA;
  return rest;
}

export const FORMULATIONS: Record<string, Formulation> = {
  [NYQUIL_ID]: nyquilFormulation,
  [CALMORA_A_ID]: calmoraAFormulation,
  [CALMORA_B_ID]: calmoraBFormulation,
};

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

const nyquilIngredients = (acetaminophen: Strength = mgPer(325, 1, "caplet")) => [
  { name: "Acetaminophen 325 mg", strength: acetaminophen },
  { name: "Dextromethorphan HBr", strength: mgPer(15, 1, "caplet") },
  { name: "Doxylamine succinate", strength: mgPer(6.25, 1, "caplet") },
];

/** NyQuil scanned by barcode, Drug Facts panel photographed; photo values match the catalog. */
export const nyquilBarcode = makeEntry({
  id: "e-nyquil",
  name: "NyQuil Cold & Flu Nighttime Relief",
  form: "caplet",
  ingredients: nyquilIngredients(),
  instructions: "Adults and children 12 years and over: take 2 caplets every 6 hours.",
  dose: dose(2, "caplets"),
  max24h: "Do not take more than 4 doses in 24 hours.",
  doc: { kind: "drug_facts_photo", date: null },
  inputMethod: "barcode",
  formulationId: NYQUIL_ID,
});

/** Same barcode, but the confirmed Drug Facts photo shows 500 mg acetaminophen per caplet. */
export const nyquilBarcodePhotoDiffers = makeEntry({
  ...specOf(nyquilBarcode),
  id: "e-nyquil-differs",
  ingredients: nyquilIngredients(mgPer(500, 1, "caplet")),
});

/** Barcode scanned, photo skipped: every value comes from the catalog (database evidence). */
export const nyquilBarcodeNoPhoto = makeEntry({
  id: "e-nyquil-nophoto",
  name: "NyQuil Cold & Flu Nighttime Relief",
  form: "caplet",
  ingredients: nyquilIngredients(),
  instructions: "Adults and children 12 years and over: take 2 caplets every 6 hours.",
  max24h: "Do not take more than 4 doses in 24 hours.",
  doc: null,
  inputMethod: "barcode",
  formulationId: NYQUIL_ID,
  evidence: { kind: "database", formulationId: NYQUIL_ID },
});

/** Calmora Bottle A picked from the catalog (the demo household's existing medicine). */
export const calmoraA = makeEntry({
  id: "e-calmora-a",
  name: "Calmora Fever Relief (Bottle A)",
  form: "liquid",
  ingredients: [{ name: "Acetaminophen", strength: mgPer(100, 5, "mL") }],
  instructions: calmoraAFormulation.directionsText,
  max24h: calmoraAFormulation.max24hText,
  doc: { kind: "otc_package", date: null },
  inputMethod: "picker",
  formulationId: CALMORA_A_ID,
  evidence: { kind: "database", formulationId: CALMORA_A_ID },
});

/** The same Calmora Bottle A entered a second time. */
export const calmoraAAgain = makeEntry({ ...specOf(calmoraA), id: "e-calmora-a-2" });

/** Calmora Bottle B photographed (no barcode): 200 mg per 5 mL. */
export const calmoraB = makeEntry({
  id: "e-calmora-b",
  name: "Calmora Extra Fever Relief (Bottle B)",
  form: "liquid",
  ingredients: [{ name: "Acetaminophen", strength: mgPer(200, 5, "mL") }],
  instructions: calmoraBFormulation.directionsText,
  max24h: calmoraBFormulation.max24hText,
  doc: { kind: "otc_package", date: null },
  inputMethod: "photo",
});

/** Prescription label: 160 mg per 5 mL, give 2 tsp. */
export const prescription = makeEntry({
  id: "e-rx",
  name: "Acetaminophen oral suspension",
  form: "oral suspension",
  ingredients: [{ name: "Acetaminophen", strength: mgPer(160, 5, "mL") }],
  instructions: "Give 2 tsp by mouth every 6 hours as needed for fever",
  dose: dose(2, "tsp"),
  doc: { kind: "prescription_label", date: "2026-10-16" },
  inputMethod: "photo",
});

/** Discharge list: 160 mg/5 mL, 10 mL every 6 hours, dated 2026-10-16. */
export const discharge = makeEntry({
  id: "e-discharge",
  name: "Acetaminophen",
  form: "oral suspension",
  ingredients: [{ name: "Acetaminophen", strength: mgPer(160, 5, "mL") }],
  instructions: "10 mL every 6 hours as needed",
  dose: dose(10, "mL"),
  doc: { kind: "discharge_list", date: "2026-10-16" },
  inputMethod: "photo",
});

const rxCrop: Evidence = { kind: "crop", sourceDocumentId: "doc-e-rx-unknown", bbox: BOX };

/** Prescription label where the user couldn't read the strength. */
export const prescriptionStrengthUnknown = makeEntry({
  ...specOf(prescription),
  id: "e-rx-unknown",
  ingredients: [{ name: "Acetaminophen", strength: cantTell(mgPer(160, 5, "mL"), rxCrop) }],
});

/** Prescription label whose strength suggestion was never acted on. */
export const prescriptionStrengthPending = makeEntry({
  ...specOf(prescription),
  id: "e-rx-pending",
  ingredients: [{ name: "Acetaminophen", strength: pending(mgPer(160, 5, "mL"), rxCrop) }],
});

/** Prescription label where the dose was not confirmed. */
export const prescriptionDosePending = makeEntry({
  ...specOf(prescription),
  id: "e-rx-dose-pending",
  dose: pending(dose(2, "tsp"), rxCrop),
});

/** Prescription label giving the dose in mg for a liquid. */
export const prescriptionMgDose = makeEntry({
  ...specOf(prescription),
  id: "e-rx-mg",
  instructions: "Give 320 mg by mouth every 6 hours as needed for fever",
  dose: dose(320, "mg"),
});

/** Prescription label with a dose whose unit isn't a measuring unit. */
export const prescriptionUnclearUnit = makeEntry({
  ...specOf(prescription),
  id: "e-rx-unclear",
  instructions: "Give 1 dose by mouth every 6 hours as needed for fever",
  dose: dose(1, "dose"),
});

/** Prescription label giving the dose in mL (lines up with a per-mL strength). */
export const prescriptionMlDose = makeEntry({
  ...specOf(prescription),
  id: "e-rx-ml",
  instructions: "Give 10 mL by mouth every 6 hours as needed for fever",
  dose: dose(10, "mL"),
});

/** A product whose active ingredient name was unreadable. */
export const unreadableIngredient = makeEntry({
  id: "e-unreadable",
  name: "Night Cold Relief",
  form: "liquid",
  ingredients: [{ name: null, strength: mgPer(160, 5, "mL") }],
  doc: { kind: "otc_package", date: null },
});

/** Calmora Bottle A still a draft (never counted). */
export const calmoraADraft = makeEntry({ ...specOf(calmoraA), id: "e-calmora-a-draft", status: "draft" });

/** Ibuprofen bottle — no shared ingredient with the acetaminophen products. */
export const ibuprofen = makeEntry({
  id: "e-ibuprofen",
  name: "Ibuprofen oral suspension",
  form: "liquid",
  ingredients: [{ name: "Ibuprofen", strength: mgPer(100, 5, "mL") }],
  doc: { kind: "otc_package", date: null },
});

/** Recover a spec from an entry so variants can override one thing. */
function specOf(e: MedicationEntry): EntrySpec {
  return {
    id: e.id,
    name: e.fields.productName,
    form: e.fields.dosageForm,
    ingredients: e.fields.ingredients.map((i) => ({ name: i.name, strength: i.strength })),
    instructions: e.fields.instructions,
    dose: e.fields.doseAsWritten,
    max24h: e.fields.max24h,
    doc: e.sourceDocument ? { kind: e.sourceDocument.kind, date: e.sourceDocument.documentDate } : null,
    inputMethod: e.inputMethod,
    formulationId: e.formulationId,
    status: e.status,
  };
}

export function input(...entries: MedicationEntry[]): CheckInput {
  return { entries, formulations: FORMULATIONS };
}
