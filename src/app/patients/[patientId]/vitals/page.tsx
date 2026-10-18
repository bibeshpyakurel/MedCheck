import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { RecordHeader } from "@/components/records/record-header";
import { VitalsScan } from "@/components/vitals/vitals-scan";
import { requireUser } from "@/lib/auth";
import { findPatient, patientMetadata } from "@/lib/page-lookup";
import { isUuid } from "@/lib/uuid";

export const generateMetadata = ({ params }: PageProps<"/patients/[patientId]/vitals">) => patientMetadata(params, "Check vitals");

/** Save with vitals, after the medicines are saved: a 30-second VitalLens face scan → the reading → Save reading. */
export default async function VitalsPage({ params }: PageProps<"/patients/[patientId]/vitals">) {
  await requireUser();
  const { patientId } = await params;
  if (!isUuid(patientId)) notFound();
  const patient = await findPatient(patientId);
  if (!patient) notFound();

  return (
    <AppShell>
      <RecordHeader patient={patient} current="medicines" />
      <div className="mx-auto max-w-lg space-y-6">
        <PageHeader
          back={{ href: `/patients/${patient.id}`, label: "My medicines" }}
          title="Check vitals"
          description="Heart rate and breathing rate, estimated from your face by the front camera."
        />
        <VitalsScan patientId={patient.id} />
      </div>
    </AppShell>
  );
}
