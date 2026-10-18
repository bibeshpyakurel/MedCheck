import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BackLink } from "@/components/page-header";
import { RecordHeader } from "@/components/records/record-header";
import { requireUser } from "@/lib/auth";
import { isReadable, photoReadFromFields, type CatalogMatch } from "@/lib/catalog-match";
import { findCatalogMatches } from "@/lib/catalog-match-server";
import { matchChoices } from "@/lib/photo-flow";
import { recordTitle } from "@/lib/record-format";
import { getEntry, getPatient, listEntries, signedPhotoUrl } from "@/lib/records";
import { isUuid } from "@/lib/uuid";
import { confirmMatchAction, saveTypedNameAction } from "./actions";
import { MatchPicker } from "./match-picker";

export const metadata: Metadata = { title: "Is this the medicine?" };

/**
 * The one-tap confirm step for a medicine-package photo: Gemini's read is matched to FDA labels and
 * the user picks the one on the package (or types the name). Query: `search=1` opens "Type it in".
 */
export default async function MatchPage({ params, searchParams }: PageProps<"/patients/[patientId]/entries/[entryId]/match">) {
  await requireUser();
  const { patientId, entryId } = await params;
  const { search } = await searchParams;
  if (!isUuid(patientId) || !isUuid(entryId)) notFound();
  const [patient, entry] = await Promise.all([getPatient(patientId), getEntry(entryId)]);
  if (!patient || !entry || entry.patientId !== patient.id) notFound();
  if (entry.status !== "draft") redirect(`/patients/${patientId}/entries/${entryId}`);
  const doc = entry.sourceDocument;
  if (doc?.kind !== "otc_package") redirect(`/patients/${patientId}/entries/${entryId}/review`);

  const read = photoReadFromFields(entry.fields);
  const [matches, photoUrl, drafts] = await Promise.all([
    findCatalogMatches(read).catch((error): CatalogMatch[] => {
      console.error("Catalog match failed", error);
      return [];
    }),
    doc.photoPath ? signedPhotoUrl(doc.photoPath) : null,
    listEntries(patientId, { status: "draft" }),
  ]);
  const { selectedId, options } = matchChoices(matches);
  const othersFromPhoto = drafts.filter((d) => d.id !== entry.id && d.sourceDocument?.id === doc.id).length;

  return (
    <AppShell>
      <RecordHeader patient={patient} current="medicines" />
      <div className="mx-auto max-w-xl space-y-6">
        <BackLink href={`/patients/${patientId}`}>{recordTitle(patient)}</BackLink>
        <MatchPicker
          patientId={patientId}
          entryId={entry.id}
          options={options}
          selectedId={selectedId}
          startInSearch={search === "1" || options.length === 0 || !isReadable(read)}
          readName={read.productName}
          photoUrl={photoUrl}
          othersFromPhoto={othersFromPhoto}
          confirmAction={confirmMatchAction}
          saveTypedAction={saveTypedNameAction}
        />
      </div>
    </AppShell>
  );
}
