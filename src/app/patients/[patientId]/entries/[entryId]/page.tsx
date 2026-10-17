import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getFormulation } from "@/lib/catalog";
import { entryLabel, formatDose, formatStrength } from "@/lib/domain/fields";
import type { Field, SourceDocumentKind } from "@/lib/domain/schema";
import { sanitizeDosageTable } from "@/lib/openfda";
import { catalogLabelSource } from "@/lib/record-format";
import { getEntry, getPatient, signedPhotoUrl } from "@/lib/records";
import { isUuid } from "@/lib/uuid";

export const metadata: Metadata = { title: "Label" };

const DOCUMENT_KIND: Record<SourceDocumentKind, string> = {
  otc_package: "Box or bottle",
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
    <div className="space-y-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
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

  return (
    <AppShell>
      <article className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3">
          <Link
            href={`/patients/${patient.id}`}
            className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            ← {patient.displayName}&apos;s medicines
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{entryLabel(fields)}</h1>
          <div className="flex flex-wrap gap-2">
            <Badge variant={entry.status === "confirmed" ? "secondary" : "outline"}>
              {entry.status === "confirmed" ? "Confirmed" : "Needs review"}
            </Badge>
            <Badge variant="outline">{INPUT_METHOD[entry.inputMethod]}</Badge>
            {doc && <Badge variant="outline">{DOCUMENT_KIND[doc.kind]}</Badge>}
            {formulation?.isFictional && <Badge variant="outline">Fictional demo product</Badge>}
          </div>
          {entry.status === "draft" && (
            <div className="flex flex-col gap-3 rounded-xl border border-unresolved/40 bg-unresolved-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-unresolved-foreground">
                You haven&apos;t confirmed these values yet. Checks only use confirmed values.
              </p>
              <Button
                className="h-11 shrink-0 px-4 text-base"
                nativeButton={false}
                render={<Link href={`/patients/${patient.id}/entries/${entry.id}/review`} />}
              >
                Review now
              </Button>
            </div>
          )}
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <section aria-labelledby="confirmed" className="space-y-4 rounded-xl border p-4">
            <h2 id="confirmed" className="font-semibold">
              What you confirmed
            </h2>
            <dl className="space-y-3">
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

          <section aria-labelledby="label-says" className="space-y-4 rounded-xl border p-4">
            <div>
              <h2 id="label-says" className="font-semibold">
                What the label says
              </h2>
              {labelSource && <p className="text-xs text-muted-foreground">{labelSource}</p>}
            </div>
            <dl className="space-y-3">
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
            <h2 id="warnings" className="text-lg font-semibold">
              Warnings, quoted from the label
            </h2>
            <ul className="space-y-2">
              {warnings.map((quote) => (
                <li key={quote}>
                  <blockquote className="border-l-4 border-finding pl-3 text-sm">“{quote}”</blockquote>
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
              className="overflow-x-auto rounded-xl border text-sm [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2 [&_td]:align-top [&_th]:border [&_th]:p-2 [&_th]:text-left"
              dangerouslySetInnerHTML={{ __html: tableHtml }}
            />
          </section>
        )}

        {photoUrl && (
          <section aria-labelledby="photo" className="space-y-3">
            <h2 id="photo" className="text-lg font-semibold">
              Your photo
            </h2>
            {/* Signed, short-lived Supabase URL; next/image would need the host configured. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt={`Photo of ${entryLabel(fields)}`} className="max-h-[32rem] w-full rounded-xl border object-contain" />
          </section>
        )}
      </article>
    </AppShell>
  );
}
