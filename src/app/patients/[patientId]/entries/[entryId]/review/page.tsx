import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ReviewForm } from "@/components/review/review-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { getFormulation } from "@/lib/catalog";
import type { Evidence, SourceDocumentKind } from "@/lib/domain/schema";
import { getEntry, getPatient, listEntries, signedPhotoUrl } from "@/lib/records";
import { confirmReviewAction, saveDraftAction } from "./actions";

export const metadata: Metadata = { title: "Check what we read" };

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
    body: "Your photo or words are saved. Type each value using Edit — every field starts as unknown.",
  },
  "ai-failed": {
    title: "We couldn't read this automatically",
    body: "Your photo or words are saved. Type each value using Edit — every field starts as unknown.",
  },
  "nothing-found": {
    title: "No medicine found in this photo",
    body: "Your photo is saved. Type the values using Edit, or go back and take a closer photo.",
  },
  "several-found": {
    title: "Several medicines found",
    body: "Each one gets its own review. After you confirm this one, the next opens.",
  },
};

export default async function ReviewPage({ params, searchParams }: PageProps<"/patients/[patientId]/entries/[entryId]/review">) {
  await requireUser();
  const { patientId, entryId } = await params;
  const { notice } = await searchParams;
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
  const newRowEvidence: Evidence = doc?.photoPath
    ? { kind: "photo", sourceDocumentId: doc.id }
    : isDescription && doc?.transcriptText
      ? { kind: "quote", text: doc.transcriptText }
      : { kind: "none" };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-2">
          <Link href={`/patients/${patientId}`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            ← {patient.displayName}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Check what we read</h1>
          <p className="text-muted-foreground">
            For each value, compare it with {isDescription ? "what you said" : "the label"} and choose <strong>Matches</strong>,{" "}
            <strong>Edit</strong> or <strong>Can&apos;t tell</strong>. Nothing counts until you do.
          </p>
          <div className="flex flex-wrap gap-2">
            {doc && <Badge variant="secondary">{KIND_LABEL[doc.kind]}</Badge>}
            {isDescription && <Badge variant="outline">From your description, not a label</Badge>}
            {formulation && <Badge variant="outline">Barcode: {formulation.brandName}</Badge>}
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
          <figure className="rounded-xl border bg-muted/40 p-4">
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
          newRowEvidence={newRowEvidence}
          confirmAction={confirmReviewAction}
          saveAction={saveDraftAction}
        />
      </div>
    </AppShell>
  );
}
