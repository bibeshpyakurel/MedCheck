import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { CaptureOptions } from "@/components/capture/capture-options";
import { AddFlowBar } from "@/components/records/add-flow-bar";
import { requireUser } from "@/lib/auth";
import { findPatient, patientMetadata } from "@/lib/page-lookup";

export const generateMetadata = ({ params }: PageProps<"/patients/[patientId]/add">) => patientMetadata(params, "Know your drugs");

/** The capture page: home until the first medicine is on file. Scan a barcode, take a photo or choose one. */
export default async function AddPage({ params }: PageProps<"/patients/[patientId]/add">) {
  await requireUser();
  const { patientId } = await params;
  if (!z.guid().safeParse(patientId).success) notFound();
  const patient = await findPatient(patientId);
  if (!patient) notFound();

  return (
    <AppShell>
      <AddFlowBar patientId={patient.id} screen="photo" />
      <div className="max-w-4xl space-y-4 sm:space-y-8">
        {/* Compact on phones: the heading and all three options fit one screen. */}
        <header className="space-y-1 sm:space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Know your drugs</h1>
          <p className="text-sm text-muted-foreground text-pretty sm:text-base">
            Scan the barcode or photograph the front of the package. MedCheck finds it in the FDA list.
          </p>
        </header>
        <CaptureOptions base={`/patients/${patientId}/add`} />
      </div>
    </AppShell>
  );
}
