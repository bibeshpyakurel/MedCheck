import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { RecordHeader } from "@/components/records/record-header";
import { requireUser } from "@/lib/auth";
import { getPatient } from "@/lib/records";
import { isUuid } from "@/lib/uuid";
import { ScanFlow } from "./scan-flow";

export const metadata: Metadata = { title: "Scan a barcode" };

export default async function ScanPage({ params }: PageProps<"/patients/[patientId]/add/scan">) {
  await requireUser();
  const { patientId } = await params;
  const patient = isUuid(patientId) ? await getPatient(patientId) : null;
  if (!patient) notFound();

  return (
    <AppShell>
      <RecordHeader patient={patient} current="medicines" />
      <div className="mx-auto max-w-lg space-y-8">
        <PageHeader
          back={{ href: `/patients/${patient.id}/add`, label: "Back" }}
          title="Scan a barcode"
          description="Point the camera at the barcode on the medicine package. MedCheck looks up the label the FDA has on file for it."
        />
        <ScanFlow patientId={patient.id} />
      </div>
    </AppShell>
  );
}
