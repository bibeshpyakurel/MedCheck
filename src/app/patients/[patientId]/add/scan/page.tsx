import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
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
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <Link href={`/patients/${patient.id}/add`} className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:underline">
            ← Other ways to add
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Scan the barcode</h1>
          <p className="mt-1 text-muted-foreground">
            For {patient.displayName}. Scan the barcode on an over-the-counter box or bottle to find its FDA label.
          </p>
        </div>
        <ScanFlow patientId={patient.id} />
      </div>
    </AppShell>
  );
}
