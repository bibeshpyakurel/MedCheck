import { describe, expect, it } from "vitest";
import { FICTIONAL_FORMULATIONS } from "@/data/fictional-formulations";
import type { CheckRun, EntryFields, Field, MedicationEntry, SourceDocument } from "@/lib/domain/schema";
import { fieldsFromFormulation } from "@/lib/domain/fields";
import { BOUNDARY_STATEMENT, buildReport, emailDraft, pendingNote, reportFilename } from "./build-report";

const patient = { displayName: "Sam", relationship: "son" };

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

const productA = { ...FICTIONAL_FORMULATIONS[0], id: "fA" };
const entryA: MedicationEntry = {
  id: "e1",
  patientId: "p1",
  sourceDocument: null,
  formulationId: "fA",
  inputMethod: "picker",
  status: "confirmed",
  fields: confirmAll(fieldsFromFormulation(productA)),
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
const draft: MedicationEntry = { ...entryA, id: "e3", status: "draft", fields: fieldsFromFormulation(productA) };

const runs: CheckRun[] = [
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
        detail: "Calmora Fever Relief and Acetaminophen both list acetaminophen as an active ingredient.",
        entryIds: ["e1", "e2"],
        evidence: [
          {
            entryId: "e2",
            entryLabel: "Acetaminophen",
            field: "ingredients[0].name",
            text: "Acetaminophen",
            evidence: { kind: "none" },
            documentKind: "discharge_list",
            documentDate: "2026-10-16",
          },
          {
            entryId: "e1",
            entryLabel: "Calmora Fever Relief",
            field: "ingredients[0].strength",
            text: "100 mg per 5 mL",
            evidence: { kind: "database", formulationId: "fA" },
            documentKind: null,
            documentDate: null,
          },
        ],
        labelWarningQuote: "Do not use with any other drug containing acetaminophen",
        pharmacistQuestion: "Both contain acetaminophen. Can they be used together, and what should I watch for?",
      },
    ],
  },
  { check: "repeated_record", status: "not_applicable", summary: "Nothing to compare", reasons: ["Only one product"], findings: [] },
  {
    check: "concentration",
    status: "unresolved",
    summary: "Needs more details",
    reasons: ["Strength unreadable on Prescription label (Amoxicillin).", "Strength unreadable on Prescription label (Amoxicillin)"],
    findings: [],
  },
  { check: "units", status: "no_finding", summary: "No unit mismatches found in confirmed fields", reasons: [], findings: [] },
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
  it("titles the report with the person's name and the generated time in the given zone", () => {
    expect(report.title).toBe("Medicine report for Sam");
    expect(report.personName).toBe("Sam");
    expect(report.generatedAt).toBe("2026-10-17T19:05:00.000Z");
    expect(report.generatedDate).toBe("2026-10-17");
    expect(report.generatedAtLabel).toMatch(/Oct(ober)? 17, 2026/);
    expect(report.generatedAtLabel).toContain("2:05");
    expect(report.generatedAtLabel).toMatch(/CDT/);
  });

  it('leaves the name out for a guest ("Guest" is not a name)', () => {
    const guest = buildReport({ caregiverName: null, patient: { displayName: " guest ", relationship: "self" }, entries: [], runs: [], generatedAt });
    expect(guest.title).toBe("Medicine report");
    expect(guest.personName).toBeNull();
  });

  it('names a "Me" profile after the person themselves, or not at all', () => {
    const me = { displayName: "Me", relationship: "self" };
    expect(buildReport({ caregiverName: "Jordan", patient: me, entries: [], runs: [], generatedAt }).title).toBe(
      "Medicine report for Jordan",
    );
    expect(buildReport({ caregiverName: null, patient: me, entries: [], runs: [], generatedAt }).title).toBe("Medicine report");
  });

  it("lists confirmed medicines with what their labels say and where it came from", () => {
    expect(report.medicines.map((m) => m.name)).toEqual([entryLabelOf(entryA), "Acetaminophen"]);
    const [a, d] = report.medicines;
    expect(a.ingredients).toEqual(["Acetaminophen 100 mg per 5 mL"]);
    expect(a.source).toBe("Picked from the MedCheck list");
    expect(d.source).toBe("Discharge list · Oct 16, 2026 · Lakeside Children's Hospital");
    expect(d.instructions).toBe("Couldn't tell");
    expect(a.doseAsWritten).toBe("Not recorded");
    expect(a.max24h).toBe("Do not give more than 5 times in 24 hours.");
    expect(a.dosageForm).toBe("liquid");
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

  it("turns findings into warnings with their evidence and the label's own words", () => {
    expect(report.warnings).toHaveLength(1);
    const w = report.warnings[0];
    expect(w.title).toBe("Two products contain acetaminophen");
    expect(w.detail).toContain("both list acetaminophen");
    expect(w.labelWarningQuote).toBe("Do not use with any other drug containing acetaminophen");
    expect(w.evidence[0]).toEqual({
      product: "Acetaminophen",
      field: "Ingredient",
      source: "Discharge list · Oct 16, 2026",
      value: "Acetaminophen",
    });
    expect(w.evidence[1]).toEqual({
      product: "Calmora Fever Relief",
      field: "Strength",
      source: "Label in the MedCheck catalog",
      value: "100 mg per 5 mL",
    });
  });

  it("marks evidence the user typed instead of presenting it as the document's", () => {
    const name = entryDischarge.fields.ingredients[0].name;
    const typed: MedicationEntry = {
      ...entryDischarge,
      fields: {
        ...entryDischarge.fields,
        ingredients: [{ ...entryDischarge.fields.ingredients[0], name: { ...name, aiValue: null, state: "edited" } }],
      },
    };
    const r = buildReport({ caregiverName: null, patient, entries: [entryA, typed], runs, generatedAt });
    expect(r.warnings[0].evidence[0].source).toBe("Discharge list · Oct 16, 2026 · Entered by you");
  });

  it("has no warnings and says so plainly when nothing was found", () => {
    const quiet = buildReport({ caregiverName: null, patient, entries: [entryA], runs: [], generatedAt });
    expect(quiet.warnings).toEqual([]);
    expect(quiet.isEmpty).toBe(false);
  });

  it("counts medicines still waiting to be checked, in plain English", () => {
    expect(report.pendingCount).toBe(1);
    expect(report.pendingNote).toBe(
      "1 medicine is waiting for you to check its details. It'll appear in the report once you confirm it.",
    );
    expect(pendingNote(2)).toBe(
      "2 medicines are waiting for you to check their details. They'll appear in the report once you confirm them.",
    );
    expect(pendingNote(0)).toBeNull();
  });

  it("lists what couldn't be compared, once each, from checks that couldn't finish", () => {
    expect(report.notCompared).toEqual(["Strength unreadable on Prescription label (Amoxicillin)"]);
  });

  it("marks a record with nothing added as empty", () => {
    const empty = buildReport({ caregiverName: null, patient, entries: [], runs: [], generatedAt });
    expect(empty.isEmpty).toBe(true);
    expect(empty.medicines).toEqual([]);
    expect(empty.pendingNote).toBeNull();
    const onlyDrafts = buildReport({ caregiverName: null, patient, entries: [draft], runs: [], generatedAt });
    expect(onlyDrafts.isEmpty).toBe(false);
    expect(onlyDrafts.pendingCount).toBe(1);
  });

  it("ends with the short evidence-not-advice line", () => {
    expect(report.boundary).toBe(BOUNDARY_STATEMENT);
    expect(BOUNDARY_STATEMENT).toBe(
      "Evidence, not advice — this report shows what labels say; it doesn't recommend a dose.",
    );
  });

  it("never mentions pharmacists, questions, demos, check names, or says safe", () => {
    // Medicines are left out: their label text is quoted as printed ("…ask a doctor or pharmacist").
    const text = JSON.stringify({ ...report, medicines: [] });
    expect(text).not.toMatch(/pharmacist|question|demo|synthetic|\bsafe/i);
    expect(text).not.toMatch(/overlap check|concentration check|checks run/i);
  });

  it("defaults to UTC when no time zone is given", () => {
    const utc = buildReport({ caregiverName: null, patient, entries: [], runs: [], generatedAt });
    expect(utc.generatedAtLabel).toMatch(/UTC/);
  });
});

describe("emailDraft", () => {
  it("uses the report title as the subject and a plain message", () => {
    const { subject, body } = emailDraft(report);
    expect(subject).toBe("Medicine report for Sam");
    expect(body.startsWith("Hi,\n\nHere is the medicine report for Sam. It lists the medicines and any warnings from their labels.")).toBe(
      true,
    );
    expect(body).toContain("Warnings:\n- Two products contain acetaminophen");
    expect(body).toContain("The PDF is attached.");
    expect(body).toContain("Thanks — Alex Rivera");
  });

  it("says when there are no warnings in confirmed fields", () => {
    const quiet = buildReport({ caregiverName: null, patient, entries: [entryA], runs: [], generatedAt });
    expect(emailDraft(quiet).body).toContain("No warnings found in confirmed fields.");
  });

  it("reads in the first person for a self or guest report, and signs only with a name it has", () => {
    const own = buildReport({ caregiverName: "Jordan", patient: { displayName: "Jordan", relationship: "self" }, entries: [], runs: [], generatedAt });
    expect(emailDraft(own).body).toContain("Here is my medicine report.");
    expect(emailDraft(own).body).toContain("Thanks — Jordan");
    const guest = buildReport({ caregiverName: null, patient: { displayName: "Guest", relationship: "self" }, entries: [], runs: [], generatedAt });
    expect(emailDraft(guest).subject).toBe("Medicine report");
    expect(emailDraft(guest).body).toContain("Here is my medicine report.");
    expect(emailDraft(guest).body).toContain("\nThanks\n");
    expect(emailDraft(guest).body).not.toContain("Thanks —");
  });

  it("never mentions pharmacists or questions, or says safe", () => {
    const { subject, body } = emailDraft(report);
    expect(`${subject}\n${body}`).not.toMatch(/pharmacist|question|\bsafe/i);
  });
});

describe("reportFilename", () => {
  it("names the file after the person and generated date", () => {
    expect(reportFilename(report)).toBe("Medicine-report-Sam-2026-10-17.pdf");
  });

  it("leaves the name out when there is none", () => {
    expect(reportFilename({ ...report, personName: null })).toBe("Medicine-report-2026-10-17.pdf");
  });

  it("strips characters that don't belong in a filename", () => {
    expect(reportFilename({ ...report, personName: 'Zoë "Z" O/Brien' })).toBe("Medicine-report-Zoe-Z-OBrien-2026-10-17.pdf");
  });
});

function entryLabelOf(entry: MedicationEntry): string {
  return entry.fields.productName.value ?? "";
}
