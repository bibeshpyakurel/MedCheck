import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { AddFlowBar } from "@/components/records/add-flow-bar";
import { requireUser } from "@/lib/auth";
import { findPatient, patientMetadata } from "@/lib/page-lookup";
import { discardReadAction, uploadPhotoAction } from "./actions";
import { PhotoForm } from "./photo-form";

export const generateMetadata = ({ params }: PageProps<"/patients/[patientId]/add/photo">) => patientMetadata(params, "Photo of the label");

// Extraction runs inside the upload Server Action; give Gemini time on slow networks.
export const maxDuration = 60;

const sourceSchema = z.enum(["camera", "library"]);

/**
 * Query: `source` (`camera` | `library`: which button comes first; the capture page sends a photo
 * already picked, which is read at once). There is no kind to choose: Gemini says what the photo shows.
 */
export default async function PhotoPage({ params, searchParams }: PageProps<"/patients/[patientId]/add/photo">) {
  await requireUser();
  const { patientId } = await params;
  const query = await searchParams;
  if (!z.guid().safeParse(patientId).success) notFound();
  const patient = await findPatient(patientId);
  if (!patient) notFound();

  const sourceParam = sourceSchema.safeParse(query.source);

  return (
    <AppShell>
      <AddFlowBar patientId={patient.id} screen="photo" />
      <div className="mx-auto max-w-xl space-y-8">
        <PageHeader
          title="Photo of the label"
          description="MedCheck reads the photo, then you confirm what it found."
        />
        <PhotoForm
          patientId={patientId}
          action={uploadPhotoAction}
          discardAction={discardReadAction}
          otherWaysHref={`/patients/${patientId}/add`}
          source={sourceParam.success ? sourceParam.data : undefined}
        />
      </div>
    </AppShell>
  );
}
