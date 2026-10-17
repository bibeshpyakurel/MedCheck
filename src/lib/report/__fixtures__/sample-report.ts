// A realistic demo report (Sam, three medicines, three findings, one unresolved check) for the
// PDF smoke test and for rendering a sample PDF by hand.
import { FICTIONAL_FORMULATIONS } from "@/data/fictional-formulations";
import type { CheckRun, EntryFields, Field, MedicationEntry, SourceDocument } from "@/lib/domain/schema";
import { fieldsFromFormulation } from "@/lib/domain/fields";
import { buildReport, type Report } from "../build-report";

function confirmAll(fields: EntryFields): EntryFields {
  const c = (f: Field<unknown>) => ({ ...f, state: f.value === null ? "unknown" : "confirmed" }) as never;
  return {
    productName: c(fields.productName),
    dosageForm: c(fields.dosageForm),
    instructions: c(fields.instructions),
    doseAsWritten: c(fields.doseAsWritten),
    max24h: c(fields.max24h),
    ingredients: fields.ingredients.map((i) => ({ name: c(i.name), strength: c(i.strength) })),
  };
}

const doc = (id: string, kind: SourceDocument["kind"], extra: Partial<SourceDocument> = {}): SourceDocument => ({
  id,
  patientId: "p1",
  kind,
  photoPath: null,
  transcriptText: null,
  documentDate: "2026-10-16",
  facility: null,
  prescriber: null,
  pharmacy: null,
  createdAt: "2026-10-17T00:00:00Z",
  ...extra,
});

const base = { patientId: "p1", status: "confirmed" as const, createdAt: "2026-10-17T00:00:00Z", confirmedAt: "2026-10-17T00:00:00Z" };
const bottleA = { ...FICTIONAL_FORMULATIONS[0], id: "fA" };
const bottleB = { ...FICTIONAL_FORMULATIONS[1], id: "fB" };

export const sampleEntries: MedicationEntry[] = [
  { ...base, id: "e1", sourceDocument: null, formulationId: "fA", inputMethod: "picker", fields: confirmAll(fieldsFromFormulation(bottleA)) },
  {
    ...base,
    id: "e2",
    sourceDocument: doc("d2", "drug_facts_photo", { documentDate: null }),
    formulationId: "fB",
    inputMethod: "barcode",
    fields: confirmAll(fieldsFromFormulation(bottleB)),
  },
  {
    ...base,
    id: "e3",
    sourceDocument: doc("d3", "discharge_list", { facility: "Lakeside Children's Hospital" }),
    formulationId: null,
    inputMethod: "photo",
    fields: {
      productName: { aiValue: "Acetaminophen 160 mg/5 mL oral suspension", value: "Acetaminophen 160 mg/5 mL oral suspension", state: "confirmed", evidence: { kind: "photo", sourceDocumentId: "d3" } },
      dosageForm: { aiValue: "liquid", value: "liquid", state: "confirmed", evidence: { kind: "photo", sourceDocumentId: "d3" } },
      ingredients: [
        {
          name: { aiValue: "Acetaminophen", value: "Acetaminophen", state: "confirmed", evidence: { kind: "photo", sourceDocumentId: "d3" } },
          strength: { aiValue: { amount: 160, unit: "mg", perAmount: 5, perUnit: "mL" }, value: { amount: 160, unit: "mg", perAmount: 5, perUnit: "mL" }, state: "confirmed", evidence: { kind: "photo", sourceDocumentId: "d3" } },
        },
      ],
      instructions: { aiValue: "10 mL every 6 hours as needed", value: "10 mL every 6 hours as needed", state: "confirmed", evidence: { kind: "photo", sourceDocumentId: "d3" } },
      doseAsWritten: { aiValue: { amount: 10, unit: "mL" }, value: { amount: 10, unit: "mL" }, state: "confirmed", evidence: { kind: "photo", sourceDocumentId: "d3" } },
      max24h: { aiValue: null, value: null, state: "unknown", evidence: { kind: "photo", sourceDocumentId: "d3" } },
    },
  },
];

const warning =
  "Do not use with any other drug containing acetaminophen (prescription or nonprescription). If you are not sure whether a drug contains acetaminophen, ask a doctor or pharmacist.";

export const sampleRuns: CheckRun[] = [
  {
    check: "ingredient_overlap",
    status: "finding",
    summary: "2 products share an active ingredient",
    reasons: [],
    findings: [
      {
        id: "ingredient_overlap:e1,e2:acetaminophen",
        check: "ingredient_overlap",
        title: "Two products contain acetaminophen",
        detail: "Calmora Fever Relief (Bottle A) and Calmora Extra Fever Relief (Bottle B) both list acetaminophen as an active ingredient.",
        entryIds: ["e1", "e2"],
        evidence: [
          { entryId: "e1", entryLabel: "Calmora Fever Relief (Bottle A)", field: "ingredients[0].name", text: "Acetaminophen", evidence: { kind: "database", formulationId: "fA" }, documentKind: null, documentDate: null },
          { entryId: "e2", entryLabel: "Calmora Extra Fever Relief (Bottle B)", field: "ingredients[0].name", text: "Acetaminophen", evidence: { kind: "crop", sourceDocumentId: "d2", bbox: { x: 0.1, y: 0.1, w: 0.3, h: 0.05 } }, documentKind: "drug_facts_photo", documentDate: null },
        ],
        labelWarningQuote: warning,
        pharmacistQuestion: "Both Calmora Fever Relief (Bottle A) and Calmora Extra Fever Relief (Bottle B) contain acetaminophen. Should these be given together, and if so, how?",
      },
    ],
  },
  { check: "repeated_record", status: "no_finding", summary: "No repeated records found in confirmed fields", reasons: [], findings: [] },
  {
    check: "concentration",
    status: "finding",
    summary: "Liquids with different concentrations",
    reasons: [],
    findings: [
      {
        id: "concentration:e1,e2:acetaminophen",
        check: "concentration",
        title: "Same volume holds different amounts of acetaminophen",
        detail: "Bottle A says 100 mg per 5 mL. Bottle B says 200 mg per 5 mL.",
        entryIds: ["e1", "e2"],
        evidence: [
          { entryId: "e1", entryLabel: "Calmora Fever Relief (Bottle A)", field: "ingredients[0].strength", text: "100 mg per 5 mL", evidence: { kind: "database", formulationId: "fA" }, documentKind: null, documentDate: null },
          { entryId: "e2", entryLabel: "Calmora Extra Fever Relief (Bottle B)", field: "ingredients[0].strength", text: "200 mg per 5 mL", evidence: { kind: "crop", sourceDocumentId: "d2", bbox: { x: 0.1, y: 0.2, w: 0.3, h: 0.05 } }, documentKind: "drug_facts_photo", documentDate: null },
        ],
        labelWarningQuote: null,
        pharmacistQuestion: "Bottle A is 100 mg per 5 mL and Bottle B is 200 mg per 5 mL. Which one should I use, and how much?",
      },
    ],
  },
  { check: "units", status: "no_finding", summary: "No unit mismatches found in confirmed fields", reasons: [], findings: [] },
  {
    check: "document_vs_bottle",
    status: "finding",
    summary: "1 conflict between documents",
    reasons: [],
    findings: [
      {
        id: "document_vs_bottle:e1,e3:strength",
        check: "document_vs_bottle",
        title: "Discharge list and bottle disagree on strength",
        detail: "The discharge list (Oct 16, 2026) says 160 mg per 5 mL. The bottle label says 100 mg per 5 mL.",
        entryIds: ["e1", "e3"],
        evidence: [
          { entryId: "e3", entryLabel: "Acetaminophen 160 mg/5 mL oral suspension", field: "ingredients[0].strength", text: "160 mg per 5 mL", evidence: { kind: "photo", sourceDocumentId: "d3" }, documentKind: "discharge_list", documentDate: "2026-10-16" },
          { entryId: "e1", entryLabel: "Calmora Fever Relief (Bottle A)", field: "ingredients[0].strength", text: "100 mg per 5 mL", evidence: { kind: "database", formulationId: "fA" }, documentKind: null, documentDate: null },
        ],
        labelWarningQuote: null,
        pharmacistQuestion: "The discharge list says 160 mg per 5 mL but the bottle label says 100 mg per 5 mL. Which strength should I be using, and how much?",
      },
    ],
  },
  {
    check: "database_vs_box",
    status: "unresolved",
    summary: "Couldn't compare the catalog label with the box",
    reasons: ["24-hour maximum unreadable on the Drug Facts photo for Calmora Extra Fever Relief (Bottle B)"],
    findings: [],
  },
];

export function sampleReport(): Report {
  return buildReport({
    caregiverName: "Alex Rivera",
    patient: { id: "p1", displayName: "Sam", relationship: "son", notes: null, isDemo: true, createdAt: "2026-10-17T00:00:00Z" },
    entries: sampleEntries,
    runs: sampleRuns,
    generatedAt: new Date("2026-10-17T19:05:00Z"),
    timeZone: "America/Chicago",
  });
}
