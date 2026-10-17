// The pharmacist report: a pure, display-ready view of a patient's record and check runs.
// The on-screen preview, the PDF and the email draft all render this one shape.
import type {
  CheckId,
  CheckRun,
  CheckStatus,
  Field,
  FindingEvidence,
  InputMethod,
  MedicationEntry,
  SourceDocument,
  SourceDocumentKind,
} from "@/lib/domain/schema";
import { entryLabel, formatDose, formatStrength, isUsable } from "@/lib/domain/fields";
import type { Patient } from "@/lib/records";

export const BOUNDARY_STATEMENT =
  "MedCheck shows what labels and documents say. It does not give medical advice, calculate doses, or say a combination is safe.";

export type ReportQuestion = { text: string; context: string };

export type ReportEvidence = { product: string; field: string; source: string; value: string };

export type ReportFinding = {
  id: string;
  check: CheckId;
  checkName: string;
  title: string;
  detail: string;
  evidence: ReportEvidence[];
  labelWarningQuote: string | null;
  pharmacistQuestion: string;
};

export type ReportCheck = {
  check: CheckId;
  name: string;
  status: CheckStatus;
  statusLabel: string;
  summary: string;
  reasons: string[];
};

export type ReportMedicine = {
  id: string;
  name: string;
  dosageForm: string;
  ingredients: string[];
  instructions: string;
  doseAsWritten: string;
  max24h: string;
  source: string;
};

export type Report = {
  title: string; // "MedCheck report for Sam", or "My MedCheck report" when the person is checking their own medicines
  isSelf: boolean; // patient relationship is "self": the report and email read in first person
  heading: string; // "Sam", or "Medicines for Jordan" when isSelf
  subheading: string | null; // "son · Prepared by Alex Rivera"; null when isSelf
  patientName: string;
  patientRelationship: string | null;
  caregiverName: string | null;
  isDemo: boolean;
  generatedAt: string; // ISO instant
  generatedDate: string; // YYYY-MM-DD in the report's time zone
  generatedAtLabel: string; // "Oct 17, 2026, 2:05 PM CDT"
  questions: ReportQuestion[];
  findings: ReportFinding[];
  checksSummary: string;
  checks: ReportCheck[];
  medicines: ReportMedicine[];
  unreviewedCount: number;
  unreviewedNote: string | null; // "1 more medicine still needs review and isn't included in the checks."
  boundary: string;
};

export const CHECK_NAMES: Record<CheckId, string> = {
  ingredient_overlap: "Ingredient overlap",
  repeated_record: "Repeated record",
  concentration: "Concentration",
  units: "Units",
  document_vs_bottle: "Document vs bottle",
  database_vs_box: "Database vs box",
};

export const STATUS_LABELS: Record<CheckStatus, string> = {
  finding: "Found something",
  no_finding: "Nothing found in confirmed fields",
  unresolved: "Couldn't be completed",
  not_applicable: "Nothing to compare",
};

export const DOCUMENT_KIND_LABELS: Record<SourceDocumentKind, string> = {
  otc_package: "Package",
  drug_facts_photo: "Drug Facts panel",
  prescription_label: "Prescription label",
  discharge_list: "Discharge list",
  description: "Description",
};

const DESCRIPTION_SOURCE = "From your description, not a label";

const INPUT_METHOD_SOURCES: Record<InputMethod, string> = {
  barcode: "Scanned barcode · label in the MedCheck catalog",
  picker: "Picked from the MedCheck list",
  photo: "Photo",
  voice: DESCRIPTION_SOURCE,
  typed: DESCRIPTION_SOURCE,
};

export function buildReport(input: {
  caregiverName: string | null;
  patient: Patient;
  entries: MedicationEntry[];
  runs: CheckRun[];
  generatedAt: Date;
  /** IANA zone for the generated date/time, e.g. "America/Chicago". Defaults to UTC. */
  timeZone?: string;
}): Report {
  const { patient, runs } = input;
  const timeZone = validTimeZone(input.timeZone);
  const confirmed = input.entries.filter((e) => e.status === "confirmed");

  const findings: ReportFinding[] = runs.flatMap((run) =>
    run.findings.map((f) => ({
      id: f.id,
      check: f.check,
      checkName: CHECK_NAMES[f.check],
      title: f.title,
      detail: f.detail,
      evidence: f.evidence.map(toReportEvidence),
      labelWarningQuote: f.labelWarningQuote,
      pharmacistQuestion: f.pharmacistQuestion,
    })),
  );

  const questions: ReportQuestion[] = [];
  const seen = new Set<string>();
  const ask = (q: ReportQuestion) => {
    if (seen.has(q.text)) return;
    seen.add(q.text);
    questions.push(q);
  };
  for (const f of findings) ask({ text: f.pharmacistQuestion, context: f.title });
  for (const run of runs.filter((r) => r.status === "unresolved")) {
    const name = CHECK_NAMES[run.check];
    const why = run.reasons.map((r) => r.trim().replace(/\.$/, "")).filter(Boolean).join("; ");
    ask({
      text: `MedCheck couldn't finish the ${name.toLowerCase()} check${why ? `: ${why}` : ""}. Can you look at this with me?`,
      context: `${name} check couldn't be completed`,
    });
  }

  const count = (s: CheckStatus) => runs.filter((r) => r.status === s).length;
  const isSelf = patient.relationship?.trim().toLowerCase() === "self";
  const caregiverName = input.caregiverName?.trim() || null;

  return {
    title: isSelf ? "My MedCheck report" : `MedCheck report for ${patient.displayName}`,
    isSelf,
    heading: isSelf ? `Medicines for ${patient.displayName}` : patient.displayName,
    subheading: isSelf
      ? null
      : [patient.relationship, caregiverName ? `Prepared by ${caregiverName}` : null].filter(Boolean).join(" · ") || null,
    patientName: patient.displayName,
    patientRelationship: patient.relationship,
    caregiverName,
    isDemo: patient.isDemo,
    generatedAt: input.generatedAt.toISOString(),
    generatedDate: new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
      input.generatedAt,
    ),
    generatedAtLabel: new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(input.generatedAt),
    questions,
    findings,
    checksSummary: `${runs.length} checks run, ${count("finding")} found something, ${count("unresolved")} couldn't be completed`,
    checks: runs.map((r) => ({
      check: r.check,
      name: CHECK_NAMES[r.check],
      status: r.status,
      statusLabel: STATUS_LABELS[r.status],
      summary: r.summary,
      reasons: r.reasons,
    })),
    medicines: confirmed.map(toReportMedicine),
    unreviewedCount: input.entries.length - confirmed.length,
    unreviewedNote: unreviewedNote(input.entries.length - confirmed.length),
    boundary: BOUNDARY_STATEMENT,
  };
}

/** Prefilled email (and share/mailto text) for the report. The user can edit both. */
export function emailDraft(report: Report): { subject: string; body: string } {
  const opening = report.isSelf
    ? "Hi, here is my MedCheck report with questions about my medicines."
    : `Hi, here is my MedCheck report for ${report.patientName}.`;
  const signer = report.isSelf ? (report.caregiverName ?? report.patientName) : report.caregiverName;
  const lines = [
    `${opening} It lists the medicines on file, what their labels and documents say, and the checks MedCheck ran.`,
    "",
  ];
  if (report.questions.length > 0) {
    lines.push("Questions I'd like to ask:");
    report.questions.forEach((q, i) => lines.push(`${i + 1}. ${q.text}`));
  } else {
    lines.push("No findings came up in the checks run on confirmed fields, but I'd like you to look over the medicines on file.");
  }
  lines.push("", "The PDF report is attached.", "", signer ? `Thanks — ${signer}` : "Thanks", "");
  lines.push(`(${report.boundary})`);
  return { subject: report.title, body: lines.join("\n") };
}

/** "MedCheck-report-Sam-2026-10-17.pdf" — ASCII only, safe in a Content-Disposition header. */
export function reportFilename(report: Pick<Report, "patientName" | "generatedDate">): string {
  const name = report.patientName
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9 -]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return `MedCheck-report-${name || "patient"}-${report.generatedDate}.pdf`;
}

// ---------------------------------------------------------------------------

function validTimeZone(tz: string | undefined): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

function unreviewedNote(n: number): string | null {
  if (n === 0) return null;
  return n === 1
    ? "1 more medicine still needs review and isn't included in the checks."
    : `${n} more medicines still need review and aren't included in the checks.`;
}

/** ISO date ("2026-10-16") → "Oct 16, 2026", without shifting the day. */
function formatDocumentDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(d);
}

function documentSource(kind: SourceDocumentKind | null, date: string | null): string | null {
  if (!kind) return null;
  if (kind === "description") return DESCRIPTION_SOURCE;
  return [DOCUMENT_KIND_LABELS[kind], date ? formatDocumentDate(date) : null].filter(Boolean).join(" · ");
}

function toReportEvidence(e: FindingEvidence): ReportEvidence {
  const fallback =
    e.evidence.kind === "database"
      ? "Label in the MedCheck catalog"
      : e.evidence.kind === "quote"
        ? DESCRIPTION_SOURCE
        : "Not linked to a document";
  return {
    product: e.entryLabel,
    field: fieldLabel(e.field),
    source: documentSource(e.documentKind, e.documentDate) ?? fallback,
    value: e.text,
  };
}

function fieldLabel(path: string): string {
  if (/strength/i.test(path)) return "Strength";
  if (/ingredients\[\d+\]\.name/.test(path)) return "Ingredient";
  const labels: Record<string, string> = {
    productName: "Product name",
    dosageForm: "Form",
    instructions: "Instructions",
    doseAsWritten: "Dose as written",
    max24h: "24-hour maximum",
  };
  return labels[path] ?? path;
}

function fieldText<T>(field: Field<T>, format: (v: T) => string): string {
  if (isUsable(field)) return format(field.value);
  if (field.state === "pending") return "Not reviewed yet";
  if (field.aiValue === null && field.evidence.kind === "none") return "Not recorded";
  return "Couldn't tell";
}

function medicineSource(entry: MedicationEntry): string {
  const doc: SourceDocument | null = entry.sourceDocument;
  if (entry.inputMethod === "voice" || entry.inputMethod === "typed" || doc?.kind === "description") {
    return DESCRIPTION_SOURCE;
  }
  if (!doc) return INPUT_METHOD_SOURCES[entry.inputMethod];
  return [
    documentSource(doc.kind, doc.documentDate),
    doc.facility,
    doc.pharmacy,
    doc.prescriber ? `Prescriber: ${doc.prescriber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function toReportMedicine(entry: MedicationEntry): ReportMedicine {
  const f = entry.fields;
  const text = (s: string) => s;
  return {
    id: entry.id,
    name: entryLabel(f),
    dosageForm: fieldText(f.dosageForm, text),
    ingredients: f.ingredients.map((i) => {
      const name = isUsable(i.name) ? i.name.value : "Ingredient (couldn't tell)";
      const strength = fieldText(i.strength, formatStrength);
      return isUsable(i.strength) ? `${name} ${strength}` : `${name}, strength: ${strength.toLowerCase()}`;
    }),
    instructions: fieldText(f.instructions, text),
    doseAsWritten: fieldText(f.doseAsWritten, formatDose),
    max24h: fieldText(f.max24h, text),
    source: medicineSource(entry),
  };
}
