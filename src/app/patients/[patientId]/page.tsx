import { ChevronRightIcon, ClipboardCheckIcon, FileTextIcon, PillIcon, PlusIcon, RotateCcwIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlreadyGaveBoth } from "@/components/already-gave-both";
import { AppShell } from "@/components/app-shell";
import { ChecksPanel } from "@/components/checks/checks-panel";
import { DemoBadge } from "@/components/records/demo-badge";
import { HistoryList } from "@/components/records/history-list";
import { MedicationList } from "@/components/records/medication-list";
import { PatientSwitcher } from "@/components/records/patient-switcher";
import { ResetDemoButton } from "@/components/records/reset-demo-button";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireUser } from "@/lib/auth";
import { getFormulationsByIds } from "@/lib/catalog";
import { runChecks } from "@/lib/checks";
import { entryLabel } from "@/lib/domain/fields";
import type { MedicationEntry } from "@/lib/domain/schema";
import {
  DOCUMENT_KIND_LABELS,
  formatDocDate,
  INPUT_METHOD_LABELS,
  personDetails,
  personLabel,
  recordTitle,
} from "@/lib/record-format";
import { getPatient, listEntries, listHistory, listPatients } from "@/lib/records";

// Malformed ids are a 404, not a database error.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps<"/patients/[patientId]">): Promise<Metadata> {
  const { patientId } = await params;
  const patient = UUID.test(patientId) ? await getPatient(patientId) : null;
  return { title: patient ? recordTitle(patient) : "Record" };
}

export default async function PatientRecordPage({ params }: PageProps<"/patients/[patientId]">) {
  await requireUser();
  const { patientId } = await params;
  const patient = UUID.test(patientId) ? await getPatient(patientId) : null;
  if (!patient) notFound();

  const [patients, entries, history] = await Promise.all([
    listPatients(),
    listEntries(patientId),
    listHistory(patientId),
  ]);
  const confirmed = entries.filter((e) => e.status === "confirmed");
  const drafts = entries.filter((e) => e.status === "draft");
  const formulations = await getFormulationsByIds(confirmed.flatMap((e) => (e.formulationId ? [e.formulationId] : [])));
  const runs = runChecks({ entries: confirmed, formulations });
  const base = `/patients/${patientId}`;

  return (
    <AppShell
      actions={
        <PatientSwitcher
          currentId={patientId}
          patients={patients.map((p) => ({ id: p.id, label: personLabel(p), isDemo: p.isDemo }))}
        />
      }
    >
      <header>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{recordTitle(patient)}</h1>
          {patient.isDemo ? <DemoBadge /> : null}
        </div>
        {personDetails(patient) ? <p className="mt-1 text-muted-foreground">{personDetails(patient)}</p> : null}

        <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
          <Button size="lg" className="h-12 px-5 text-base" nativeButton={false} render={<Link href={`${base}/add`} />}>
            <PlusIcon aria-hidden /> Add a medicine
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-12 px-5 text-base"
            nativeButton={false}
            render={<Link href={`${base}/export`} />}
          >
            <ClipboardCheckIcon aria-hidden /> Pharmacist report
          </Button>
          <div className="*:w-full sm:ml-auto sm:*:w-auto">
            <AlreadyGaveBoth />
          </div>
        </div>
      </header>

      {drafts.length > 0 ? <NeedsReview base={base} drafts={drafts} /> : null}

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)]">
        <div className="lg:sticky lg:top-20 lg:order-2">
          <ChecksPanel runs={runs} />
        </div>

        <Tabs defaultValue="medicines" className="lg:order-1">
          <TabsList className="h-11! w-full sm:w-auto">
            <TabsTrigger value="medicines" className="min-w-28 px-3">
              Medicines
              <span className="text-xs text-muted-foreground tabular-nums">{confirmed.length}</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="min-w-28 px-3">
              History
            </TabsTrigger>
          </TabsList>
          <TabsContent value="medicines" className="mt-3">
            {confirmed.length === 0 ? (
              <EmptyMedicines base={base} hasDrafts={drafts.length > 0} />
            ) : (
              <MedicationList patientId={patientId} entries={confirmed} />
            )}
          </TabsContent>
          <TabsContent value="history" className="mt-3">
            <HistoryList items={history} />
          </TabsContent>
        </Tabs>
      </div>

      {patient.isDemo ? (
        <div className="mt-12 flex flex-wrap items-center gap-3 border-t pt-6 text-sm">
          <p className="text-muted-foreground">Presenting? Put the demo household back the way it started.</p>
          <ResetDemoButton variant="ghost" className="h-11">
            <RotateCcwIcon aria-hidden /> Reset demo
          </ResetDemoButton>
        </div>
      ) : null}
    </AppShell>
  );
}

function NeedsReview({ base, drafts }: { base: string; drafts: MedicationEntry[] }) {
  return (
    <section aria-labelledby="review-heading" className="mt-8 rounded-xl border border-unresolved/40 bg-unresolved-surface p-4">
      <h2 id="review-heading" className="font-semibold text-unresolved-foreground">
        Needs review <span className="font-normal">({drafts.length})</span>
      </h2>
      <p className="mt-0.5 text-sm text-unresolved-foreground/80">
        These aren&apos;t checked until you confirm what MedCheck read.
      </p>
      <ul className="mt-3 space-y-2">
        {drafts.map((d) => {
          const doc = d.sourceDocument;
          const meta = [doc ? DOCUMENT_KIND_LABELS[doc.kind] : null, formatDocDate(doc?.documentDate ?? null), INPUT_METHOD_LABELS[d.inputMethod]]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={d.id}>
              <Link
                href={`${base}/entries/${d.id}/review`}
                className="flex min-h-14 items-center gap-3 rounded-lg bg-card px-3 py-2.5 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                <FileTextIcon aria-hidden className="size-4 shrink-0 text-unresolved" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{entryLabel(d.fields)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{meta}</span>
                </span>
                <span className="text-sm font-medium text-primary">Review</span>
                <ChevronRightIcon aria-hidden className="size-4 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EmptyMedicines({ base, hasDrafts }: { base: string; hasDrafts: boolean }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center">
      <PillIcon aria-hidden className="mx-auto size-8 text-muted-foreground" />
      <p className="mt-3 font-medium">No confirmed medicines yet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground text-pretty">
        {hasDrafts
          ? "Review the medicines above to add them to the record."
          : "Scan a barcode, photograph a label or discharge list, or describe a medicine in your own words."}
      </p>
      {hasDrafts ? null : (
        <Button className="mt-5 h-11 px-4" nativeButton={false} render={<Link href={`${base}/add`} />}>
          <PlusIcon aria-hidden /> Add a medicine
        </Button>
      )}
    </div>
  );
}
