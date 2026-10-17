import {
  ChevronRightIcon,
  CircleDashedIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  type LucideIcon,
  PillIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchCheckIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resetDemo } from "@/app/actions/session";
import { AlreadyGaveBoth } from "@/components/already-gave-both";
import { AppShell } from "@/components/app-shell";
import { ChecksPanel } from "@/components/checks/checks-panel";
import { DemoBadge } from "@/components/records/demo-badge";
import { HistoryList } from "@/components/records/history-list";
import { MedicationList } from "@/components/records/medication-list";
import { PatientSwitcher } from "@/components/records/patient-switcher";
import { PersonAvatar } from "@/components/records/person-avatar";
import { SubmitButton } from "@/components/records/submit-button";
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
import { cn } from "@/lib/utils";

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

  const found = runs.filter((r) => r.status === "finding").length;
  const unresolved = runs.filter((r) => r.status === "unresolved").length;

  return (
    <AppShell
      actions={
        <PatientSwitcher
          currentId={patientId}
          patients={patients.map((p) => ({ id: p.id, label: personLabel(p), isDemo: p.isDemo }))}
        />
      }
    >
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-4">
          <PersonAvatar name={patient.displayName} className="size-14 text-xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{recordTitle(patient)}</h1>
              {patient.isDemo ? <DemoBadge /> : null}
            </div>
            {personDetails(patient) ? <p className="mt-1 text-muted-foreground">{personDetails(patient)}</p> : null}
          </div>
        </div>

        <div className="grid gap-2.5 sm:flex sm:flex-wrap sm:items-center">
          <Button size="lg" className="h-11 px-4" nativeButton={false} render={<Link href={`${base}/add`} />}>
            <PlusIcon aria-hidden /> Add a medicine
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-11 px-4"
            nativeButton={false}
            render={<Link href={`${base}/export`} />}
          >
            <ClipboardCheckIcon aria-hidden /> Pharmacist report
          </Button>
          <div className="*:w-full sm:*:w-auto">
            <AlreadyGaveBoth />
          </div>
        </div>
      </header>

      <dl className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={PillIcon} label="Confirmed medicines" value={confirmed.length} />
        <Metric icon={FileTextIcon} label="Waiting for review" value={drafts.length} tone={drafts.length > 0 ? "unresolved" : undefined} />
        <Metric icon={SearchCheckIcon} label="Checks that found something" value={found} tone={found > 0 ? "finding" : undefined} />
        <Metric icon={CircleDashedIcon} label="Couldn't be completed" value={unresolved} tone={unresolved > 0 ? "unresolved" : undefined} />
      </dl>

      {drafts.length > 0 ? <NeedsReview base={base} drafts={drafts} /> : null}

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="lg:sticky lg:top-24 lg:order-2">
          <ChecksPanel runs={runs} />
        </div>

        <Tabs defaultValue="medicines" className="gap-4 lg:order-1">
          <TabsList className="h-11! w-full sm:w-auto sm:self-start">
            <TabsTrigger value="medicines" className="min-w-32 px-4">
              Medicines
              <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums ring-1 ring-border">
                {confirmed.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="history" className="min-w-32 px-4">
              History
            </TabsTrigger>
          </TabsList>
          <TabsContent value="medicines">
            {confirmed.length === 0 ? (
              <EmptyMedicines base={base} hasDrafts={drafts.length > 0} />
            ) : (
              <MedicationList patientId={patientId} entries={confirmed} />
            )}
          </TabsContent>
          <TabsContent value="history">
            <HistoryList items={history} />
          </TabsContent>
        </Tabs>
      </div>

      {patient.isDemo ? (
        <form
          action={resetDemo}
          className="mt-14 flex flex-col gap-3 rounded-2xl border border-dashed bg-surface p-5 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-muted-foreground">Presenting? Put the demo household back the way it started.</p>
          <SubmitButton variant="outline" className="h-11" pendingLabel="Resetting…">
            <RotateCcwIcon aria-hidden /> Reset demo
          </SubmitButton>
        </form>
      ) : null}
    </AppShell>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: "finding" | "unresolved";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs",
        tone === "finding" && "border-finding/40 bg-finding-surface/60",
        tone === "unresolved" && "border-unresolved/35 bg-unresolved-surface/60",
      )}
    >
      <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon
          aria-hidden
          className={cn(
            "size-4",
            tone === "finding" && "text-finding",
            tone === "unresolved" && "text-unresolved",
          )}
        />
        {label}
      </dt>
      <dd className="font-display text-3xl font-semibold tracking-tight nums">{value}</dd>
    </div>
  );
}

function NeedsReview({ base, drafts }: { base: string; drafts: MedicationEntry[] }) {
  return (
    <section
      aria-labelledby="review-heading"
      className="mt-6 overflow-hidden rounded-2xl border border-unresolved/35 bg-unresolved-surface/70"
    >
      <div className="flex items-start gap-3 px-5 pt-4 pb-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-card text-unresolved ring-1 ring-unresolved/30">
          <FileTextIcon aria-hidden className="size-4" />
        </span>
        <div>
          <h2 id="review-heading" className="font-semibold text-unresolved-foreground">
            Needs review <span className="font-normal">({drafts.length})</span>
          </h2>
          <p className="mt-0.5 text-sm text-unresolved-foreground/80">
            These aren&apos;t checked until you confirm what MedCheck read.
          </p>
        </div>
      </div>
      <ul className="space-y-2 px-3 pb-3">
        {drafts.map((d) => {
          const doc = d.sourceDocument;
          const meta = [doc ? DOCUMENT_KIND_LABELS[doc.kind] : null, formatDocDate(doc?.documentDate ?? null), INPUT_METHOD_LABELS[d.inputMethod]]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={d.id}>
              <Link
                href={`${base}/entries/${d.id}/review`}
                className="group flex min-h-14 items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-xs ring-1 ring-border transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{entryLabel(d.fields)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{meta}</span>
                </span>
                <span className="text-sm font-semibold text-primary">Review</span>
                <ChevronRightIcon aria-hidden className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
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
    <div className="rounded-2xl border border-dashed bg-card/50 px-6 py-14 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-xl bg-accent text-accent-foreground ring-1 ring-primary/15">
        <PillIcon aria-hidden className="size-6" />
      </span>
      <p className="mt-4 font-semibold">No confirmed medicines yet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground text-pretty">
        {hasDrafts
          ? "Review the medicines above to add them to the record."
          : "Scan a barcode, photograph a label or discharge list, or describe a medicine in your own words."}
      </p>
      {hasDrafts ? null : (
        <Button className="mt-6 h-11 px-4" nativeButton={false} render={<Link href={`${base}/add`} />}>
          <PlusIcon aria-hidden /> Add a medicine
        </Button>
      )}
    </div>
  );
}
