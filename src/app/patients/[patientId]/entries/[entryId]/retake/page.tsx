import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CameraIcon, KeyboardIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BackLink } from "@/components/page-header";
import { RecordHeader } from "@/components/records/record-header";
import { SubmitButton } from "@/components/records/submit-button";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { recordTitle } from "@/lib/record-format";
import { getEntry, getPatient, signedPhotoUrl } from "@/lib/records";
import { isUuid } from "@/lib/uuid";
import { retakePhotoAction } from "../match/actions";

export const metadata: Metadata = { title: "Retake the photo" };

/** A medicine-package photo Gemini couldn't read (no name, no ingredient): retake it, or type the name. */
export default async function RetakePage({ params }: PageProps<"/patients/[patientId]/entries/[entryId]/retake">) {
  await requireUser();
  const { patientId, entryId } = await params;
  if (!isUuid(patientId) || !isUuid(entryId)) notFound();
  const [patient, entry] = await Promise.all([getPatient(patientId), getEntry(entryId)]);
  if (!patient || !entry || entry.patientId !== patient.id) notFound();
  if (entry.status !== "draft") redirect(`/patients/${patientId}/entries/${entryId}`);
  const doc = entry.sourceDocument;
  if (doc?.kind !== "otc_package") redirect(`/patients/${patientId}/entries/${entryId}/review`);
  const photoUrl = doc.photoPath ? await signedPhotoUrl(doc.photoPath) : null;

  return (
    <AppShell>
      <RecordHeader patient={patient} current="medicines" />
      <div className="mx-auto max-w-xl space-y-6">
        <BackLink href={`/patients/${patientId}`}>{recordTitle(patient)}</BackLink>
        <header className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            We couldn&apos;t read this label — retake the photo
          </h1>
          <p className="leading-relaxed text-muted-foreground text-pretty">
            Photograph the front of the package up close, so the name and strength fill the frame. Use good light and
            avoid glare.
          </p>
        </header>
        {photoUrl && (
          // Signed, short-lived Supabase URL; next/image would need the host configured.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="Your photo" className="max-h-56 w-full rounded-2xl border bg-surface object-contain shadow-xs" />
        )}
        <div className="space-y-3">
          <form action={retakePhotoAction.bind(null, { patientId, entryId })}>
            <SubmitButton size="lg" className="h-12 w-full text-base" pendingLabel="One moment…">
              <CameraIcon aria-hidden className="size-5" /> Retake photo
            </SubmitButton>
          </form>
          <Button
            variant="outline"
            size="lg"
            className="h-12 w-full text-base"
            nativeButton={false}
            render={<Link href={`/patients/${patientId}/entries/${entryId}/match?search=1`} />}
          >
            <KeyboardIcon aria-hidden className="size-5" /> Type it in instead
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
