import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { getFormulation } from "@/lib/catalog";
import { getPatient } from "@/lib/records";
import { uploadPhotoAction } from "./actions";
import { PhotoForm, type PhotoKind } from "./photo-form";

export const metadata: Metadata = { title: "Photo of a label" };

// Extraction runs inside the upload Server Action; give Gemini time on slow networks.
export const maxDuration = 60;

const kindSchema = z.enum(["prescription_label", "discharge_list", "otc_package", "drug_facts_photo"]);

/**
 * Query: `kind` (default prescription_label), optional `formulationId` (barcode path: keeps the
 * catalog link, `inputMethod: "barcode"`), optional `method` (`photo` | `barcode`).
 */
export default async function PhotoPage({ params, searchParams }: PageProps<"/patients/[patientId]/add/photo">) {
  await requireUser();
  const { patientId } = await params;
  const query = await searchParams;
  if (!z.guid().safeParse(patientId).success) notFound();
  const patient = await getPatient(patientId);
  if (!patient) notFound();

  const kindParam = kindSchema.safeParse(query.kind);
  const formulationParam = z.guid().safeParse(query.formulationId);
  const formulation = formulationParam.success ? await getFormulation(formulationParam.data) : null;
  const kind: PhotoKind = formulation ? "drug_facts_photo" : kindParam.success ? kindParam.data : "prescription_label";

  return (
    <AppShell>
      <div className="mx-auto max-w-xl space-y-6">
        <div className="space-y-2">
          <Link href={`/patients/${patientId}/add`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            ← Add a medicine
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {formulation ? "Photograph the Drug Facts panel" : "Photo of a label or document"}
          </h1>
          <p className="text-muted-foreground">
            {formulation ? (
              <>
                Scanned: <strong className="text-foreground">{formulation.brandName}</strong>. A photo of the box lets
                MedCheck compare what&apos;s printed with the FDA label on file.
              </>
            ) : (
              <>For {patient.displayName}. MedCheck reads the values; you check each one before anything is saved.</>
            )}
          </p>
        </div>
        <PhotoForm
          patientId={patientId}
          initialKind={kind}
          formulationId={formulation?.id ?? null}
          action={uploadPhotoAction}
        />
      </div>
    </AppShell>
  );
}
