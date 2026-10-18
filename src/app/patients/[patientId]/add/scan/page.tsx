import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AddFlowBar } from "@/components/records/add-flow-bar";
import { requireUser } from "@/lib/auth";
import { findPatient, patientMetadata } from "@/lib/page-lookup";
import { isUuid } from "@/lib/uuid";
import { ScanFlow } from "./scan-flow";

export const generateMetadata = ({ params }: PageProps<"/patients/[patientId]/add/scan">) => patientMetadata(params, "Scan a barcode");

/** Scan the barcode (or type the NDC) on a medicine package → its FDA label → one tap to save it. */
export default async function ScanPage({ params }: PageProps<"/patients/[patientId]/add/scan">) {
  await requireUser();
  const { patientId } = await params;
  if (!isUuid(patientId)) notFound();
  const patient = await findPatient(patientId);
  if (!patient) notFound();

  return (
    <AppShell>
      <AddFlowBar patientId={patient.id} screen="scan" />
      <div className="mx-auto max-w-lg space-y-6">
        <header className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">Scan a barcode</h1>
          <p className="leading-relaxed text-muted-foreground text-pretty">
            Point the camera at the barcode on the medicine package. MedCheck finds the label the FDA has on file for it.
          </p>
        </header>
        <ScanFlow patientId={patient.id} />
      </div>
    </AppShell>
  );
}
