import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BackLink } from "@/components/page-header";
import { RecordHeader } from "@/components/records/record-header";
import { ReviewForm } from "@/components/review/review-form";
import { DECISION_LABELS } from "@/components/review/review-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { getFormulation } from "@/lib/catalog";
import { entryLabel } from "@/lib/domain/fields";
import type { Evidence, SourceDocumentKind } from "@/lib/domain/schema";
import { catalogMatchLabel, recordTitle } from "@/lib/record-format";
import { getEntry, getPatient, listEntries, signedPhotoUrl } from "@/lib/records";
import { confirmReviewAction, saveDraftAction } from "./actions";

export const metadata: Metadata = { title: "Check the details" };

const KIND_LABEL: Record<SourceDocumentKind, string> = {
  prescription_label: "Prescription label",
  discharge_list: "Discharge list",
  otc_package: "Medicine package",
  drug_facts_photo: "Drug Facts panel",
  description: "Your description",
};

const NOTICES: Record<string, { title: string; body: string }> = {
  "ai-unavailable": {
    title: "Automatic reading isn't set up",
    body: "Your photo or words are saved. Type each detail using Change it — every detail starts as unknown.",
  },
  "ai-failed": {
    title: "We couldn't read this automatically",
    body: "Your photo or words are saved. Type each detail using Change it — every detail starts as unknown.",
  },
  "nothing-found": {
    title: "No medicine found in this photo",
    body: "Your photo is saved. Type the details using Change it, or go back and take a closer photo.",
  },
  "several-found": {
    title: "Several medicines found",
    body: "Each one gets its own review. After you confirm this one, the next opens.",
  },
};

export default async function ReviewPage({ params, searchParams }: PageProps<"/patients/[patientId]/entries/[entryId]/review">) {
  await requireUser();
  const { patientId, entryId } = await params;
  const { notice, from: fromParam } = await searchParams;
  const from = fromParam === "entry" ? "entry" : null;
  const [patient, entry] = await Promise.all([getPatient(patientId), getEntry(entryId)]);
  if (!patient || !entry || entry.patientId !== patientId) notFound();

  const doc = entry.sourceDocument;
  const [photoUrl, formulation, drafts] = await Promise.all([
    doc?.photoPath ? signedPhotoUrl(doc.photoPath) : null,
    entry.formulationId ? getFormulation(entry.formulationId) : null,
    listEntries(patientId, { status: "draft" }),
  ]);
  const othersWaiting = drafts.filter((d) => d.id !== entry.id).length;
  const isDescription = doc?.kind === "description" || entry.inputMethod === "voice" || entry.inputMethod === "typed";
  const message = typeof notice === "string" ? NOTICES[notice] : undefined;
  const choices = DECISION_LABELS[isDescription ? "description" : "label"];
  const newRowEvidence: Evidence = doc?.photoPath
    ? { kind: "photo", sourceDocumentId: doc.id }
    : isDescription && doc?.transcriptText
      ? { kind: "quote", text: doc.transcriptText }
      : { kind: "none" };

  return (
    <AppShell>
      <RecordHeader patient={patient} current="medicines" />
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-3">
          {from === "entry" ? (
            <BackLink href={`/patients/${patientId}/entries/${entry.id}`}>{entryLabel(entry.fields)}</BackLink>
          ) : (
            <BackLink href={`/patients/${patientId}`}>{recordTitle(patient)}</BackLink>
          )}
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Check the details</h1>
          <p className="max-w-2xl leading-relaxed text-muted-foreground">
            Look at each detail MedCheck read and compare it with {isDescription ? "what you said" : "the label"}. Pick one:
          </p>
          <ul className="max-w-2xl space-y-1 text-sm leading-relaxed text-muted-foreground">
            <li>
              <strong className="text-foreground">{choices.matches}</strong> — it&apos;s right.
            </li>
            <li>
              <strong className="text-foreground">{choices.change}</strong> — type it the way it&apos;s{" "}
              {isDescription ? "said" : "printed"}.
            </li>
            <li>
              <strong className="text-foreground">{choices.unknown}</strong> — MedCheck will leave this detail unknown and
              won&apos;t compare it.
            </li>
          </ul>
          <p className="text-sm text-muted-foreground">Nothing is compared until you choose.</p>
          <div className="flex flex-wrap gap-2">
            {doc && <Badge variant="secondary">{KIND_LABEL[doc.kind]}</Badge>}
            {isDescription && <Badge variant="outline">From your description, not a label</Badge>}
            {formulation && <Badge variant="outline">{catalogMatchLabel(entry.inputMethod, formulation.brandName)}</Badge>}
            {entry.status === "confirmed" && <Badge variant="outline">Already confirmed</Badge>}
          </div>
          {othersWaiting > 0 && (
            <p className="text-sm text-muted-foreground">
              {othersWaiting} more {othersWaiting === 1 ? "medicine is" : "medicines are"} waiting for review.
            </p>
          )}
        </div>

        {message && (
          <Alert>
            <AlertTitle>{message.title}</AlertTitle>
            <AlertDescription>{message.body}</AlertDescription>
          </Alert>
        )}

        {isDescription && doc?.transcriptText && (
          <figure className="rounded-2xl border bg-surface p-5">
            <figcaption className="text-sm font-medium text-muted-foreground">What you said</figcaption>
            <blockquote className="mt-1 text-base">&ldquo;{doc.transcriptText}&rdquo;</blockquote>
          </figure>
        )}

        <ReviewForm
          patientId={patientId}
          entryId={entry.id}
          initialFields={entry.fields}
          initialDocument={
            doc && !isDescription
              ? { documentDate: doc.documentDate, facility: doc.facility, prescriber: doc.prescriber, pharmacy: doc.pharmacy }
              : null
          }
          photoUrl={photoUrl}
          source={isDescription ? "description" : "label"}
          newRowEvidence={newRowEvidence}
          confirmAction={confirmReviewAction}
          saveAction={saveDraftAction}
          from={from}
        />
      </div>
    </AppShell>
  );
}
