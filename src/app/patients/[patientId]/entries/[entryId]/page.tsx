import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheckIcon, FileTextIcon, PencilIcon, TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { BackLink } from "@/components/page-header";
import { RecordHeader } from "@/components/records/record-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getFormulation } from "@/lib/catalog";
import { entryLabel, formatDose, formatStrength } from "@/lib/domain/fields";
import type { Field, SourceDocumentKind } from "@/lib/domain/schema";
import { sanitizeDosageTable } from "@/lib/openfda";
import { catalogLabelSource, formatDocDate, recordTitle } from "@/lib/record-format";
import { getEntry, getPatient, signedPhotoUrl } from "@/lib/records";
import { isUuid } from "@/lib/uuid";

export const metadata: Metadata = { title: "Details and label" };

const DOCUMENT_KIND: Record<SourceDocumentKind, string> = {
  otc_package: "Medicine package",
  drug_facts_photo: "Drug Facts photo",
  prescription_label: "Prescription label",
  discharge_list: "Discharge list",
  description: "Your description",
};

const INPUT_METHOD = {
  barcode: "Barcode",
  photo: "Photo",
  voice: "Voice",
  typed: "Typed",
  picker: "Picked from list",
} as const;

/** A field's value with what the user did with it. Pending values are shown but marked. */
function FieldValue<T>({ field, format }: { field: Field<T>; format: (v: T) => string }) {
  if (field.state === "unknown" || field.value === null) {
    // "Couldn't tell" only when there was something to read; catalog entries never carry some fields.
    const couldntTell = field.state === "unknown" && field.evidence.kind !== "none";
    return <span className="text-muted-foreground">{couldntTell ? "Couldn't tell" : "Not on file"}</span>;
  }
  return (
    <span>
      {format(field.value)}
      {field.state === "pending" && <span className="ml-1 text-sm text-unresolved-foreground">(not confirmed yet)</span>}
      {field.state === "edited" && <span className="ml-1 text-sm text-muted-foreground">(you corrected this)</span>}
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1 px-5 py-3.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="font-medium nums">{children}</dd>
    </div>
  );
}

export default async function EntryLabelPage({ params }: PageProps<"/patients/[patientId]/entries/[entryId]">) {
  await requireUser();
  const { patientId, entryId } = await params;
  if (!isUuid(patientId) || !isUuid(entryId)) notFound();
  const [patient, entry] = await Promise.all([getPatient(patientId), getEntry(entryId)]);
  if (!patient || !entry || entry.patientId !== patient.id) notFound();

  const formulation = entry.formulationId ? await getFormulation(entry.formulationId) : null;
  const photoPath = entry.sourceDocument?.photoPath;
  const photoUrl = photoPath ? await signedPhotoUrl(photoPath) : null;
  const { fields } = entry;
  const doc = entry.sourceDocument;

  const directions = formulation?.directionsText ?? fields.instructions.value ?? fields.instructions.aiValue;
  const max24h = formulation?.max24hText ?? fields.max24h.value ?? fields.max24h.aiValue;
  const warnings = formulation?.warningsQuotes ?? [];
  // Sanitized at ingest too; sanitize again on the way out (table tags only).
  const tableHtml = formulation?.dosageTableHtml ? sanitizeDosageTable(formulation.dosageTableHtml) : null;
  const labelSource = formulation
    ? catalogLabelSource(formulation)
    : doc
      ? `${DOCUMENT_KIND[doc.kind]}${doc.documentDate ? `, ${doc.documentDate}` : ""}`
      : null;

  // Source details live here rather than in the medicine list.
  const sourceRows = (
    [
      ["Added by", INPUT_METHOD[entry.inputMethod]],
      ["Document", doc ? DOCUMENT_KIND[doc.kind] : null],
      ["Date on the document", formatDocDate(doc?.documentDate ?? null)],
      ["Hospital or clinic", doc?.facility],
      ["Prescriber", doc?.prescriber],
      ["Pharmacy", doc?.pharmacy],
    ] satisfies [string, string | null | undefined][]
  ).filter((row): row is [string, string] => Boolean(row[1]));

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <RecordHeader patient={patient} current="medicines" />
        <article className="space-y-8">
          <header className="space-y-3">
            <BackLink href={`/patients/${patient.id}`}>{recordTitle(patient)}</BackLink>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{entryLabel(fields)}</h1>
            <div className="flex flex-wrap gap-2">
              <Badge variant={entry.status === "confirmed" ? "secondary" : "outline"}>
                {entry.status === "confirmed" ? "Confirmed" : "Waiting for review"}
              </Badge>
              <Badge variant="outline">{INPUT_METHOD[entry.inputMethod]}</Badge>
              {doc && <Badge variant="outline">{DOCUMENT_KIND[doc.kind]}</Badge>}
            </div>
            {entry.status === "draft" && (
              <div className="flex flex-col gap-3 rounded-2xl border border-unresolved/35 bg-unresolved-surface/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-unresolved-foreground">
                  You haven&apos;t confirmed these details yet. MedCheck only compares details you confirmed.
                </p>
                <Button
                  className="h-11 shrink-0 px-4 text-base"
                  nativeButton={false}
                  render={<Link href={`/patients/${patient.id}/entries/${entry.id}/review`} />}
                >
                  Check details
                </Button>
              </div>
            )}
            {entry.status === "confirmed" && (
              <Button
                variant="outline"
                className="h-11 px-4"
                nativeButton={false}
                render={<Link href={`/patients/${patient.id}/entries/${entry.id}/review`} />}
              >
                <PencilIcon aria-hidden /> Check or change the details
              </Button>
            )}
          </header>

          <div className="grid gap-5 lg:grid-cols-2">
            <section aria-labelledby="confirmed" className="overflow-hidden rounded-2xl border bg-card shadow-xs">
              <div className="flex items-center gap-3 border-b bg-surface px-5 py-3.5">
                <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground ring-1 ring-primary/15">
                  <BadgeCheckIcon aria-hidden className="size-4" />
                </span>
                <h2 id="confirmed" className="font-semibold">
                  What you confirmed
                </h2>
              </div>
              <dl className="divide-y">
                <Row label="Form">
                  <FieldValue field={fields.dosageForm} format={(v) => v} />
                </Row>
                {fields.ingredients.length === 0 && <Row label="Active ingredients">None on file</Row>}
                {fields.ingredients.map((ingredient, i) => (
                  <Row key={i} label={`Strength — ${ingredient.name.value ?? ingredient.name.aiValue ?? "ingredient"}`}>
                    <FieldValue field={ingredient.strength} format={formatStrength} />
                  </Row>
                ))}
                <Row label="Amount in the directions, as written">
                  <FieldValue field={fields.doseAsWritten} format={formatDose} />
                </Row>
                <Row label="24-hour maximum">
                  <FieldValue field={fields.max24h} format={(v) => v} />
                </Row>
              </dl>
            </section>

            <section aria-labelledby="label-says" className="overflow-hidden rounded-2xl border bg-card shadow-xs">
              <div className="flex items-center gap-3 border-b bg-surface px-5 py-3.5">
                <span className="grid size-8 place-items-center rounded-lg bg-card text-muted-foreground ring-1 ring-border">
                  <FileTextIcon aria-hidden className="size-4" />
                </span>
                <div className="min-w-0">
                  <h2 id="label-says" className="font-semibold">
                    What the label says
                  </h2>
                  {labelSource && <p className="truncate text-xs text-muted-foreground">{labelSource}</p>}
                </div>
              </div>
              <dl className="divide-y">
                {formulation && (
                  <Row label="Strength on the label">
                    {formulation.activeIngredients.map((i) => `${i.name} ${formatStrength(i.strength)}`).join(" · ")}
                  </Row>
                )}
                <Row label="Directions">
                  <span className="font-normal">{directions ? `“${directions}”` : "Not on file"}</span>
                </Row>
                <Row label="24-hour maximum">{max24h ? `“${max24h}”` : "Not on file"}</Row>
              </dl>
            </section>
          </div>

          {warnings.length > 0 && (
            <section aria-labelledby="warnings" className="space-y-3">
              <h2 id="warnings" className="flex items-center gap-2 text-lg font-semibold">
                <TriangleAlertIcon aria-hidden className="size-5 text-finding" />
                Warnings, quoted from the label
              </h2>
              <ul className="overflow-hidden rounded-2xl border border-finding/30 bg-finding-surface/60 divide-y divide-finding/20">
                {warnings.map((quote) => (
                  <li key={quote} className="px-5 py-3.5">
                    <blockquote className="border-l-2 border-finding pl-3 text-sm leading-relaxed">“{quote}”</blockquote>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tableHtml && (
            <section aria-labelledby="dosing-table" className="space-y-3">
              <div>
                <h2 id="dosing-table" className="text-lg font-semibold">
                  Dosing table from the label
                </h2>
                <p className="text-sm text-muted-foreground">
                  Shown in full, exactly as printed. MedCheck doesn&apos;t pick a row — ask a pharmacist which one applies.
                </p>
              </div>
              <div
                className="overflow-x-auto rounded-2xl border bg-card text-sm shadow-xs [&_table]:w-full [&_table]:border-collapse [&_td]:border-t [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_th]:bg-surface [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:font-semibold [&_tr:first-child_td]:border-t-0"
                dangerouslySetInnerHTML={{ __html: tableHtml }}
              />
            </section>
          )}

          {sourceRows.length > 0 && (
            <section aria-labelledby="source" className="overflow-hidden rounded-2xl border bg-card shadow-xs">
              <h2 id="source" className="border-b bg-surface px-5 py-3.5 font-semibold">
                Where this came from
              </h2>
              <dl className="divide-y">
                {sourceRows.map(([label, value]) => (
                  <Row key={label} label={label}>
                    {value}
                  </Row>
                ))}
              </dl>
            </section>
          )}

          {photoUrl && (
            <section aria-labelledby="photo" className="space-y-3">
              <h2 id="photo" className="text-lg font-semibold">
                Your photo
              </h2>
              {/* Signed, short-lived Supabase URL; next/image would need the host configured. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt={`Photo of ${entryLabel(fields)}`} className="max-h-[32rem] w-full rounded-2xl border bg-surface object-contain shadow-xs" />
            </section>
          )}
        </article>
      </div>
    </AppShell>
  );
}
