import { describe, expect, it } from "vitest";
import { FICTIONAL_FORMULATIONS } from "@/data/fictional-formulations";
import type { CheckRun, EntryFields, Field, MedicationEntry, SourceDocument } from "@/lib/domain/schema";
import { fieldsFromFormulation } from "@/lib/domain/fields";
import type { Patient } from "@/lib/records";
import { BOUNDARY_STATEMENT, buildReport, emailDraft, reportFilename } from "./build-report";

const patient: Patient = {
  id: "p1",
  displayName: "Sam",
  relationship: "son",
  notes: null,
  isDemo: true,
  createdAt: "2026-10-17T00:00:00Z",
};

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

const discharge: SourceDocument = {
  id: "d1",
  patientId: "p1",
  kind: "discharge_list",
  photoPath: null,
  transcriptText: null,
  documentDate: "2026-10-16",
  facility: "Lakeside Children's Hospital",
  prescriber: null,
  pharmacy: null,
  createdAt: "2026-10-17T00:00:00Z",
};

const bottleA = { ...FICTIONAL_FORMULATIONS[0], id: "fA" };
const entryA: MedicationEntry = {
  id: "e1",
  patientId: "p1",
  sourceDocument: null,
  formulationId: "fA",
  inputMethod: "picker",
  status: "confirmed",
  fields: confirmAll(fieldsFromFormulation(bottleA)),
  createdAt: "2026-10-17T00:00:00Z",
  confirmedAt: "2026-10-17T00:00:00Z",
};
const entryDischarge: MedicationEntry = {
  ...entryA,
  id: "e2",
  formulationId: null,
  inputMethod: "photo",
  sourceDocument: discharge,
  fields: {
    ...entryA.fields,
    productName: { aiValue: "Acetaminophen", value: "Acetaminophen", state: "confirmed", evidence: { kind: "none" } },
    instructions: { aiValue: "10 mL every 6 hours", value: null, state: "unknown", evidence: { kind: "photo", sourceDocumentId: "d1" } },
  },
};
const draft: MedicationEntry = { ...entryA, id: "e3", status: "draft", fields: fieldsFromFormulation(bottleA) };

const runs: CheckRun[] = [
  {
    check: "ingredient_overlap",
    status: "no_finding",
    summary: "No overlap found in confirmed fields",
    reasons: [],
    findings: [],
  },
  { check: "repeated_record", status: "not_applicable", summary: "Nothing to compare", reasons: ["Only one product"], findings: [] },
  {
    check: "concentration",
    status: "unresolved",
    summary: "Couldn't compare concentrations",
    reasons: ["Strength unreadable on Prescription label"],
    findings: [],
  },
  { check: "units", status: "not_applicable", summary: "Nothing to compare", reasons: [], findings: [] },
  {
    check: "document_vs_bottle",
    status: "finding",
    summary: "1 conflict between documents",
    reasons: [],
    findings: [
      {
        id: "document_vs_bottle:e1,e2:strength",
        check: "document_vs_bottle",
        title: "Discharge list and bottle disagree on strength",
        detail: "The discharge list says 160 mg per 5 mL. The bottle says 100 mg per 5 mL.",
        entryIds: ["e1", "e2"],
        evidence: [
          {
            entryId: "e2",
            entryLabel: "Acetaminophen",
            field: "ingredients[0].strength",
            text: "160 mg per 5 mL",
            evidence: { kind: "none" },
            documentKind: "discharge_list",
            documentDate: "2026-10-16",
          },
          {
            entryId: "e1",
            entryLabel: "Calmora Fever Relief (Bottle A)",
            field: "ingredients[0].strength",
            text: "100 mg per 5 mL",
            evidence: { kind: "database", formulationId: "fA" },
            documentKind: null,
            documentDate: null,
          },
        ],
        labelWarningQuote: "Do not use with any other drug containing acetaminophen",
        pharmacistQuestion:
          "The discharge list says 160 mg per 5 mL but the bottle says 100 mg per 5 mL. Which strength should I be using, and how much?",
      },
    ],
  },
  { check: "database_vs_box", status: "not_applicable", summary: "No barcode entries", reasons: [], findings: [] },
];

const generatedAt = new Date("2026-10-17T19:05:00Z");
const report = buildReport({
  caregiverName: "Alex Rivera",
  patient,
  entries: [entryA, entryDischarge, draft],
  runs,
  generatedAt,
  timeZone: "America/Chicago",
});

describe("buildReport", () => {
  it("fills the header with patient, caregiver and the generated time in the given zone", () => {
    expect(report.patientName).toBe("Sam");
    expect(report.patientRelationship).toBe("son");
    expect(report.caregiverName).toBe("Alex Rivera");
    expect(report.isDemo).toBe(true);
    expect(report.generatedAt).toBe("2026-10-17T19:05:00.000Z");
    expect(report.generatedDate).toBe("2026-10-17");
    expect(report.generatedAtLabel).toMatch(/Oct(ober)? 17, 2026/);
    expect(report.generatedAtLabel).toContain("2:05");
    expect(report.generatedAtLabel).toMatch(/CDT/);
  });

  it("lists the pharmacist questions from findings first", () => {
    expect(report.questions[0]).toEqual({
      text: "The discharge list says 160 mg per 5 mL but the bottle says 100 mg per 5 mL. Which strength should I be using, and how much?",
      context: "Discharge list and bottle disagree on strength",
    });
  });

  it("turns unresolved checks into questions naming the reason", () => {
    const q = report.questions.find((x) => x.text.includes("Strength unreadable on Prescription label"));
    expect(q).toBeDefined();
    expect(q?.context).toBe("Concentration check couldn't be completed");
  });

  it("deduplicates repeated questions", () => {
    const twice = buildReport({
      caregiverName: null,
      patient,
      entries: [],
      runs: runs.map((r) => (r.check === "document_vs_bottle" ? { ...r, findings: [...r.findings, ...r.findings] } : r)),
      generatedAt,
    });
    const texts = twice.questions.map((q) => q.text);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("shows findings with evidence: product, document kind and date, value as printed, and the label warning", () => {
    expect(report.findings).toHaveLength(1);
    const f = report.findings[0];
    expect(f.checkName).toBe("Document vs bottle");
    expect(f.labelWarningQuote).toBe("Do not use with any other drug containing acetaminophen");
    expect(f.evidence[0]).toEqual({
      product: "Acetaminophen",
      field: "Strength",
      source: "Discharge list · Oct 16, 2026",
      value: "160 mg per 5 mL",
    });
    expect(f.evidence[1].source).toBe("Label in the MedCheck catalog");
  });

  it("marks evidence the user typed instead of presenting it as the document's", () => {
    const strength = entryDischarge.fields.ingredients[0].strength;
    const typed: MedicationEntry = {
      ...entryDischarge,
      fields: {
        ...entryDischarge.fields,
        ingredients: [{ ...entryDischarge.fields.ingredients[0], strength: { ...strength, aiValue: null, state: "edited" } }],
      },
    };
    const r = buildReport({ caregiverName: null, patient, entries: [entryA, typed], runs, generatedAt });
    expect(r.findings[0].evidence[0].source).toBe("Discharge list · Oct 16, 2026 · Entered by you");
    expect(r.findings[0].evidence[1].source).toBe("Label in the MedCheck catalog");
  });

  it("lists every check run with its status and reasons, unresolved ones included", () => {
    expect(report.checks.map((c) => c.check)).toEqual(runs.map((r) => r.check));
    const conc = report.checks.find((c) => c.check === "concentration")!;
    expect(conc.status).toBe("unresolved");
    expect(conc.statusLabel).toBe("Couldn't be completed");
    expect(conc.reasons).toEqual(["Strength unreadable on Prescription label"]);
    const overlap = report.checks.find((c) => c.check === "ingredient_overlap")!;
    expect(overlap.statusLabel).toBe("Nothing found in confirmed fields");
    expect(report.checksSummary).toBe(
      "2 of 6 checks compared confirmed values, 1 found something, 1 couldn't be completed, 3 had nothing to compare",
    );
  });

  it("never says checks ran when none had anything to compare", () => {
    const empty = runs.map((r) => ({ ...r, status: "not_applicable" as const, findings: [] }));
    const r = buildReport({ caregiverName: null, patient, entries: [entryA], runs: empty, generatedAt });
    expect(r.checksSummary).toBe("None of the 6 checks could compare confirmed values yet, 6 had nothing to compare");
  });

  it("lists confirmed medicines with their source, and counts drafts separately", () => {
    expect(report.medicines.map((m) => m.name)).toEqual(["Calmora Fever Relief (Bottle A)", "Acetaminophen"]);
    const [a, d] = report.medicines;
    expect(a.ingredients).toEqual(["Acetaminophen 100 mg per 5 mL"]);
    expect(a.source).toBe("Picked from the MedCheck list");
    expect(d.source).toBe("Discharge list · Oct 16, 2026 · Lakeside Children's Hospital");
    expect(d.instructions).toBe("Couldn't tell");
    expect(a.doseAsWritten).toBe("Not recorded");
    expect(a.max24h).toBe("Do not give more than 5 times in 24 hours.");
    expect(a.dosageForm).toBe("liquid");
    expect(report.unreviewedCount).toBe(1);
    expect(report.unreviewedNote).toBe("1 more medicine still needs review and isn't included in the checks.");
  });

  it("marks description entries as not from a label", () => {
    const described = buildReport({
      caregiverName: null,
      patient,
      entries: [{ ...entryA, inputMethod: "typed", sourceDocument: { ...discharge, kind: "description", documentDate: null, facility: null } }],
      runs,
      generatedAt,
    });
    expect(described.medicines[0].source).toBe("From your description, not a label");
  });

  it("ends with the boundary statement", () => {
    expect(report.boundary).toBe(BOUNDARY_STATEMENT);
    expect(BOUNDARY_STATEMENT).toBe(
      "MedCheck shows what labels and documents say. It does not give medical advice, calculate doses, or say a combination is safe.",
    );
  });

  it('never uses the word "safe" outside the boundary statement', () => {
    const text = JSON.stringify({ ...report, boundary: "" });
    expect(text).not.toMatch(/\bsafe(ly|ty)?\b/i);
    const empty = buildReport({ caregiverName: null, patient, entries: [], runs: [], generatedAt });
    expect(JSON.stringify({ ...empty, boundary: "" })).not.toMatch(/\bsafe/i);
  });

  it("defaults to UTC when no time zone is given", () => {
    const utc = buildReport({ caregiverName: null, patient, entries: [], runs: [], generatedAt });
    expect(utc.generatedAtLabel).toMatch(/UTC/);
    expect(utc.caregiverName).toBeNull();
  });
});

describe("emailDraft", () => {
  it("fills the patient and caregiver names", () => {
    const draftEmail = emailDraft(report);
    expect(draftEmail.subject).toBe("MedCheck report for Sam");
    expect(draftEmail.body.startsWith("Hi, here is my MedCheck report for Sam.")).toBe(true);
    expect(draftEmail.body).toContain("— Alex Rivera");
    expect(draftEmail.body).toContain("1. The discharge list says 160 mg per 5 mL");
  });

  it("omits the signature name when the caregiver has none", () => {
    const anon = emailDraft({ ...report, caregiverName: null });
    expect(anon.body).not.toContain("—");
    expect(anon.body).toContain("Thanks");
  });

  it('never uses the word "safe" outside the boundary statement', () => {
    const { subject, body } = emailDraft(report);
    expect(`${subject}\n${body.replace(BOUNDARY_STATEMENT, "")}`).not.toMatch(/\bsafe/i);
  });
});

describe("first-person reports (relationship is self)", () => {
  const own = buildReport({
    caregiverName: "Jordan",
    patient: { ...patient, displayName: "Jordan", relationship: "Self" },
    entries: [entryA],
    runs,
    generatedAt,
  });

  it("titles the report in first person, with no separate caregiver line", () => {
    expect(own.isSelf).toBe(true);
    expect(own.title).toBe("My MedCheck report");
    expect(own.heading).toBe("Medicines for Jordan");
    expect(own.subheading).toBeNull();
  });

  it("drafts a first-person email signed with the person's name", () => {
    const { subject, body } = emailDraft(own);
    expect(subject).toBe("My MedCheck report");
    expect(body.startsWith("Hi, here is my MedCheck report with questions about my medicines.")).toBe(true);
    expect(body).toContain("— Jordan");
    expect(body).not.toContain("report for");
  });

  it("falls back to the patient's name when there is no caregiver name", () => {
    const anon = buildReport({
      caregiverName: null,
      patient: { ...patient, displayName: "Jordan", relationship: "self" },
      entries: [],
      runs: [],
      generatedAt,
    });
    expect(emailDraft(anon).body).toContain("— Jordan");
  });

  it('uses the person\'s own name when the profile is labelled "Me"', () => {
    const me = buildReport({
      caregiverName: "Alex Rivera",
      patient: { ...patient, displayName: "Me", relationship: "self" },
      entries: [],
      runs: [],
      generatedAt,
    });
    expect(me.heading).toBe("Medicines for Alex Rivera");
    expect(emailDraft(me).body).toContain("— Alex Rivera");
    expect(reportFilename(me)).toBe("MedCheck-report-Alex-Rivera-2026-10-17.pdf");
  });

  it("keeps the caregiver wording for anyone else", () => {
    expect(report.isSelf).toBe(false);
    expect(report.title).toBe("MedCheck report for Sam");
    expect(report.heading).toBe("Sam");
    expect(report.subheading).toBe("son · Prepared by Alex Rivera");
  });
});

describe("reportFilename", () => {
  it("names the file after the patient and generated date", () => {
    expect(reportFilename(report)).toBe("MedCheck-report-Sam-2026-10-17.pdf");
  });

  it("strips characters that don't belong in a filename", () => {
    expect(reportFilename({ ...report, patientName: 'Zoë "Z" O/Brien' })).toBe("MedCheck-report-Zoe-Z-OBrien-2026-10-17.pdf");
  });
});
