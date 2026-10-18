import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { RecordHeader } from "@/components/records/record-header";
import { requireUser } from "@/lib/auth";
import { getPatient } from "@/lib/records";
import { discardReadAction, uploadPhotoAction } from "./actions";
import { PhotoForm, type PhotoKind } from "./photo-form";

export const metadata: Metadata = { title: "Photo of the label" };

// Extraction runs inside the upload Server Action; give Gemini time on slow networks.
export const maxDuration = 60;

const kindSchema = z.enum(["prescription_label", "discharge_list", "otc_package"]);
const sourceSchema = z.enum(["camera", "library"]);

/**
 * Query: `source` (`camera` | `library`: which button comes first; the capture page sends a photo
 * already picked) and `kind` (default otc_package: the product is package-first).
 */
export default async function PhotoPage({ params, searchParams }: PageProps<"/patients/[patientId]/add/photo">) {
  await requireUser();
  const { patientId } = await params;
  const query = await searchParams;
  if (!z.guid().safeParse(patientId).success) notFound();
  const patient = await getPatient(patientId);
  if (!patient) notFound();

  const kindParam = kindSchema.safeParse(query.kind);
  const sourceParam = sourceSchema.safeParse(query.source);
  const kind: PhotoKind = kindParam.success ? kindParam.data : "otc_package";

  return (
    <AppShell>
      <RecordHeader patient={patient} current="medicines" />
      <div className="mx-auto max-w-xl space-y-8">
        <PageHeader
          back={{ href: `/patients/${patientId}/add`, label: "Back" }}
          title="Photo of the label"
          description="Say what the photo shows, then MedCheck reads it. Nothing is saved until you confirm it."
        />
        <PhotoForm
          patientId={patientId}
          initialKind={kind}
          action={uploadPhotoAction}
          discardAction={discardReadAction}
          otherWaysHref={`/patients/${patientId}/add`}
          source={sourceParam.success ? sourceParam.data : undefined}
        />
      </div>
    </AppShell>
  );
}
