// The medicine report: a pure, display-ready view of a person's medicines and any warnings.
// The PDF (preview, download, share) and the email draft all render this one shape.
import type {
  CheckRun,
  Field,
  FindingEvidence,
  InputMethod,
  MedicationEntry,
  SourceDocument,
  SourceDocumentKind,
} from "@/lib/domain/schema";
import { evidenceProvenance } from "@/lib/checks/evidence-source";
import { entryLabel, formatDose, formatStrength, isUsable } from "@/lib/domain/fields";
import type { Patient } from "@/lib/records";

export const BOUNDARY_STATEMENT = "Evidence, not advice — this report shows what labels say; it doesn't recommend a dose.";

export const NO_WARNINGS = "No warnings found in confirmed fields.";

export type ReportEvidence = { product: string; field: string; source: string; value: string };

export type ReportWarning = {
  id: string;
  title: string;
  detail: string;
  evidence: ReportEvidence[];
  labelWarningQuote: string | null;
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
  title: string; // "Medicine report for Sam", or "Medicine report" when there is no real name (a guest)
  personName: string | null;
  isSelf: boolean; // the person's own medicines: the email reads in the first person
  caregiverName: string | null;
  generatedAt: string; // ISO instant
  generatedDate: string; // YYYY-MM-DD in the report's time zone
  generatedAtLabel: string; // "Oct 17, 2026, 2:05 PM CDT"
  medicines: ReportMedicine[]; // confirmed only
  warnings: ReportWarning[];
  pendingCount: number; // added but not confirmed yet
  pendingNote: string | null;
  notCompared: string[]; // details the checks couldn't use ("Strength unreadable on …")
  isEmpty: boolean; // nothing added at all
  boundary: string;
};

const DOCUMENT_KIND_LABELS: Record<SourceDocumentKind, string> = {
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

/** Placeholder profile names that aren't a person's name. */
const GENERIC_NAME = /^(guest|me|myself)$/i;

export function buildReport(input: {
  caregiverName: string | null;
  patient: Pick<Patient, "displayName" | "relationship">;
  entries: MedicationEntry[];
  runs: CheckRun[];
  generatedAt: Date;
  /** IANA zone for the generated date/time, e.g. "America/Chicago". Defaults to UTC. */
  timeZone?: string;
}): Report {
  const { patient, runs } = input;
  const timeZone = validTimeZone(input.timeZone);
  const confirmed = input.entries.filter((e) => e.status === "confirmed");
  const byId = new Map(input.entries.map((e) => [e.id, e]));
  const isSelf = patient.relationship?.trim().toLowerCase() === "self";
  const caregiverName = realName(input.caregiverName);
  // A "self" profile may be labelled "Me"; the report names the person themselves.
  const personName = realName(patient.displayName) ?? (isSelf ? caregiverName : null);
  const pendingCount = input.entries.length - confirmed.length;

  return {
    title: personName ? `Medicine report for ${personName}` : "Medicine report",
    personName,
    isSelf,
    caregiverName,
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
    medicines: confirmed.map(toReportMedicine),
    warnings: runs.flatMap((run) =>
      run.findings.map((f) => ({
        id: f.id,
        title: f.title,
        detail: f.detail,
        evidence: f.evidence.map((e) => toReportEvidence(e, byId.get(e.entryId))),
        labelWarningQuote: f.labelWarningQuote,
      })),
    ),
    pendingCount,
    pendingNote: pendingNote(pendingCount),
    notCompared: [
      ...new Set(
        runs
          .filter((r) => r.status === "unresolved" || r.status === "finding")
          .flatMap((r) => r.reasons.map((reason) => reason.trim().replace(/\.$/, "")))
          .filter(Boolean),
      ),
    ],
    isEmpty: input.entries.length === 0,
    boundary: BOUNDARY_STATEMENT,
  };
}

/** "2 medicines are waiting for you to check their details. They'll appear in the report once you confirm them." */
export function pendingNote(n: number): string | null {
  if (n <= 0) return null;
  return n === 1
    ? "1 medicine is waiting for you to check its details. It'll appear in the report once you confirm it."
    : `${n} medicines are waiting for you to check their details. They'll appear in the report once you confirm them.`;
}

/** Prefilled email (and share/mailto text) for the report. The user can edit both. */
export function emailDraft(report: Report): { subject: string; body: string } {
  const whose = report.isSelf || !report.personName ? "my medicine report" : `the medicine report for ${report.personName}`;
  const signer = report.isSelf ? report.personName : report.caregiverName;
  const lines = ["Hi,", "", `Here is ${whose}. It lists the medicines and any warnings from their labels.`, ""];
  if (report.medicines.length === 0) {
    lines.push("There are no confirmed medicines in it yet.");
  } else if (report.warnings.length === 0) {
    lines.push(NO_WARNINGS);
  } else {
    lines.push("Warnings:", ...[...new Set(report.warnings.map((w) => w.title))].map((t) => `- ${t}`));
  }
  lines.push("", "The PDF is attached.", "", signer ? `Thanks — ${signer}` : "Thanks", "", `(${report.boundary})`);
  return { subject: report.title, body: lines.join("\n") };
}

/** "Medicine-report-Sam-2026-10-17.pdf" — ASCII only, safe in a Content-Disposition header. */
export function reportFilename(report: Pick<Report, "personName" | "generatedDate">): string {
  const name = (report.personName ?? "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9 -]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return ["Medicine-report", name, report.generatedDate].filter(Boolean).join("-") + ".pdf";
}

// ---------------------------------------------------------------------------

function realName(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  return trimmed && !GENERIC_NAME.test(trimmed) ? trimmed : null;
}

function validTimeZone(tz: string | undefined): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
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

function toReportEvidence(e: FindingEvidence, entry: MedicationEntry | undefined): ReportEvidence {
  const fallback =
    e.evidence.kind === "database"
      ? "Label in the MedCheck catalog"
      : e.evidence.kind === "quote"
        ? DESCRIPTION_SOURCE
        : "Not linked to a document";
  const source = documentSource(e.documentKind, e.documentDate) ?? fallback;
  return {
    product: e.entryLabel,
    field: fieldLabel(e.field),
    // A value the user typed or corrected isn't the document's own text.
    source: evidenceProvenance(e, entry) === "entered" ? `${source} · Entered by you` : source,
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
  if (field.state === "pending") return "Not checked yet";
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
