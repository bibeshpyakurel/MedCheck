import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { CaptureOptions } from "@/components/capture/capture-options";
import { PageHeader } from "@/components/page-header";
import { RecordHeader } from "@/components/records/record-header";
import { requireUser } from "@/lib/auth";
import { getPatient } from "@/lib/records";

export const metadata: Metadata = { title: "Add a medicine" };

/** The capture page: where people land after signing in. Scan a barcode, take a photo, or choose one. */
export default async function AddPage({ params }: PageProps<"/patients/[patientId]/add">) {
  await requireUser();
  const { patientId } = await params;
  if (!z.guid().safeParse(patientId).success) notFound();
  const patient = await getPatient(patientId);
  if (!patient) notFound();

  return (
    <AppShell>
      <RecordHeader patient={patient} current="medicines" />
      <div className="mx-auto max-w-4xl space-y-5 sm:space-y-8">
        <PageHeader
          title="Add a medicine"
          description={<>Scan the barcode or photograph the label. You&apos;ll check what MedCheck read before it&apos;s used.</>}
        />
        <CaptureOptions base={`/patients/${patientId}/add`} />
      </div>
    </AppShell>
  );
}
