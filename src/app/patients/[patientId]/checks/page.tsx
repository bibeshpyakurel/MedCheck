import { FileTextIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ChecksPanel } from "@/components/checks/checks-panel";
import { PageHeader } from "@/components/page-header";
import { RecordHeader } from "@/components/records/record-header";
import { requireUser } from "@/lib/auth";
import { getFormulationsByIds } from "@/lib/catalog";
import { runChecks } from "@/lib/checks";
import { getPatient, listEntries } from "@/lib/records";
import { isUuid } from "@/lib/uuid";

export const metadata: Metadata = { title: "Checks" };

export default async function ChecksPage({ params }: PageProps<"/patients/[patientId]/checks">) {
  await requireUser();
  const { patientId } = await params;
  const patient = isUuid(patientId) ? await getPatient(patientId) : null;
  if (!patient) notFound();

  const entries = await listEntries(patientId);
  const confirmed = entries.filter((e) => e.status === "confirmed");
  const drafts = entries.length - confirmed.length;
  const formulations = await getFormulationsByIds(confirmed.flatMap((e) => (e.formulationId ? [e.formulationId] : [])));
  const runs = runChecks({ entries: confirmed, formulations });

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <RecordHeader patient={patient} current="checks" />
        <PageHeader
          title="Checks"
          description="MedCheck compared the details you confirmed, using six fixed rules. It shows what the labels say; a pharmacist helps decide what to do."
        />

        {drafts > 0 ? (
          <Link
            href={`/patients/${patientId}`}
            className="mt-6 flex min-h-11 items-center gap-2 rounded-xl border border-unresolved/35 bg-unresolved-surface/70 px-4 py-3 text-sm text-unresolved-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <FileTextIcon aria-hidden className="size-4 shrink-0" />
            <span>
              {drafts} {drafts === 1 ? "medicine is" : "medicines are"} waiting for review and not in these checks.{" "}
              <span className="font-semibold underline underline-offset-4">Check details</span>
            </span>
          </Link>
        ) : null}

        <div className="mt-8">
          <ChecksPanel runs={runs} patientId={patientId} entries={confirmed} formulations={formulations} />
        </div>
      </div>
    </AppShell>
  );
}
