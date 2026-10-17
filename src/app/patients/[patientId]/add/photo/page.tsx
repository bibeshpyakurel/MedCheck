import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { RecordHeader } from "@/components/records/record-header";
import { requireUser } from "@/lib/auth";
import { getFormulation } from "@/lib/catalog";
import { getPatient } from "@/lib/records";
import { uploadPhotoAction } from "./actions";
import { PhotoForm, type PhotoKind } from "./photo-form";

export const metadata: Metadata = { title: "Photo of the label" };

// Extraction runs inside the upload Server Action; give Gemini time on slow networks.
export const maxDuration = 60;

const kindSchema = z.enum(["prescription_label", "discharge_list", "otc_package", "drug_facts_photo"]);
const sourceSchema = z.enum(["camera", "library"]);

/**
 * Query: `source` (`camera` | `library`: which button comes first; the capture page sends a photo
 * already picked), `kind` (default prescription_label), optional `formulationId` (barcode path:
 * keeps the catalog link, `inputMethod: "barcode"`), optional `method` (`photo` | `barcode`).
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
  const formulationParam = z.guid().safeParse(query.formulationId);
  const formulation = formulationParam.success ? await getFormulation(formulationParam.data) : null;
  const kind: PhotoKind = formulation ? "drug_facts_photo" : kindParam.success ? kindParam.data : "prescription_label";

  return (
    <AppShell>
      <RecordHeader patient={patient} current="medicines" />
      <div className="mx-auto max-w-xl space-y-8">
        <PageHeader
          back={{ href: `/patients/${patientId}/add`, label: "Back" }}
          title={formulation ? "Photograph the Drug Facts panel" : "Photo of the label"}
          description={
            formulation ? (
              <>
                Scanned: <strong className="text-foreground">{formulation.brandName}</strong>. The Drug Facts panel is the
                box on the back listing ingredients, uses and directions. A photo of it lets MedCheck compare what&apos;s
                printed with the {formulation.isFictional ? "fictional label" : "FDA label"} on file.
              </>
            ) : (
              <>Say what the photo shows, then MedCheck reads it. You check each detail before anything is used.</>
            )
          }
        />
        <PhotoForm
          patientId={patientId}
          initialKind={kind}
          formulationId={formulation?.id ?? null}
          action={uploadPhotoAction}
          otherWaysHref={`/patients/${patientId}/add`}
          source={sourceParam.success ? sourceParam.data : undefined}
        />
      </div>
    </AppShell>
  );
}
