import { ChevronDownIcon, ChevronRightIcon, CircleDashedIcon, FileTextIcon, HistoryIcon, PillIcon, PlusIcon, SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { WarningCard } from "@/components/checks/warning-card";
import { HistoryList } from "@/components/records/history-list";
import { MedicationList } from "@/components/records/medication-list";
import { RecordHeader } from "@/components/records/record-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getFormulationsByIds } from "@/lib/catalog";
import { runChecks } from "@/lib/checks";
import { type WarningsView, warningsView } from "@/lib/checks/warnings";
import { entryLabel } from "@/lib/domain/fields";
import type { Formulation, MedicationEntry } from "@/lib/domain/schema";
import { DOCUMENT_KIND_LABELS, formatDocDate, INPUT_METHOD_LABELS, recordTitle } from "@/lib/record-format";
import { overlappingIngredients } from "@/lib/overlap-visual";
import { draftPath } from "@/lib/photo-flow";
import { findPatient, NOT_FOUND_TITLE } from "@/lib/page-lookup";
import { listEntries, listHistory } from "@/lib/records";

export async function generateMetadata({ params }: PageProps<"/patients/[patientId]">): Promise<Metadata> {
  const { patientId } = await params;
  const patient = await findPatient(patientId);
  return { title: patient ? recordTitle(patient) : NOT_FOUND_TITLE };
}

/**
 * The Medicines tab: the person's medicine history. Phone order: title and Add a medicine · what's
 * waiting for review · warnings (actual findings only) · the list · activity.
 */
export default async function PatientRecordPage({ params }: PageProps<"/patients/[patientId]">) {
  await requireUser();
  const { patientId } = await params;
  // Malformed ids are a 404, not a database error.
  const patient = await findPatient(patientId);
  if (!patient) notFound();

  const [entries, history] = await Promise.all([listEntries(patientId), listHistory(patientId)]);
  const confirmed = entries.filter((e) => e.status === "confirmed");
  const drafts = entries.filter((e) => e.status === "draft");
  const formulations = await getFormulationsByIds(confirmed.flatMap((e) => (e.formulationId ? [e.formulationId] : [])));
  const view = warningsView(runChecks({ entries: confirmed, formulations }));
  const overlapping = [...overlappingIngredients(view.warnings, new Map(confirmed.map((e) => [e.id, e])))];
  const base = `/patients/${patientId}`;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <RecordHeader patient={patient} current="medicines" />

        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{recordTitle(patient)}</h1>
            <p className="mt-1 text-muted-foreground nums">
              {confirmed.length} {confirmed.length === 1 ? "medicine" : "medicines"} on file
            </p>
          </div>
          {/* Phones add from the bottom bar. */}
          <Button size="lg" className="hidden h-11 px-4 text-base sm:inline-flex" nativeButton={false} render={<Link href={`${base}/add`} />}>
            <PlusIcon aria-hidden /> Add a medicine
          </Button>
        </header>

        <div className="mt-6 space-y-8">
          {drafts.length > 0 ? <NeedsReview drafts={drafts} /> : null}

          {confirmed.length > 0 ? (
            <Warnings view={view} patientId={patientId} entries={confirmed} formulations={formulations} />
          ) : null}

          <section id="medicines" aria-labelledby="medicines-heading" className="scroll-mt-24">
            <h2 id="medicines-heading" className="mb-3 text-lg font-semibold">
              Medicines
            </h2>
            {confirmed.length === 0 ? (
              <EmptyMedicines hasDrafts={drafts.length > 0} />
            ) : (
              <MedicationList patientId={patientId} entries={confirmed} overlapping={overlapping} />
            )}
          </section>

          <Disclosure icon={HistoryIcon} title="Activity" hint="What was added or changed, newest first">
            <HistoryList items={history} />
          </Disclosure>
        </div>
      </div>
    </AppShell>
  );
}

/** Only real findings, each in plain English with its evidence one tap away. Never green, never "safe". */
function Warnings({
  view,
  patientId,
  entries,
  formulations,
}: {
  view: WarningsView;
  patientId: string;
  entries: MedicationEntry[];
  formulations: Record<string, Formulation>;
}) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  return (
    <section aria-labelledby="warnings-heading" className="space-y-3">
      <h2 id="warnings-heading" className="text-lg font-semibold">
        Warnings{view.warnings.length > 0 ? <span className="nums"> ({view.warnings.length})</span> : null}
      </h2>
      {view.warnings.map((finding) => (
        <WarningCard key={finding.id} finding={finding} patientId={patientId} entries={byId} formulations={formulations} />
      ))}
      {view.emptyLine ? (
        <p className="flex items-start gap-3 rounded-2xl border bg-card px-4 py-3.5 text-pretty">
          <SearchIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          {view.emptyLine}
        </p>
      ) : null}
      {view.incompleteLine ? (
        <p className="flex items-start gap-3 rounded-2xl border border-unresolved/35 bg-unresolved-surface/70 px-4 py-3.5 text-sm text-unresolved-foreground text-pretty">
          <CircleDashedIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          {view.incompleteLine}
        </p>
      ) : null}
    </section>
  );
}

/** A secondary destination folded away under a plain heading. Content stays in the page for search and print. */
function Disclosure({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: typeof HistoryIcon;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-2xl border bg-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{title}</span>
          <span className="block text-sm text-muted-foreground">{hint}</span>
        </span>
        <ChevronDownIcon aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t p-4">{children}</div>
    </details>
  );
}

function NeedsReview({ drafts }: { drafts: MedicationEntry[] }) {
  return (
    <section aria-labelledby="review-heading" className="rounded-2xl border border-unresolved/35 bg-unresolved-surface/70 p-4 sm:p-5">
      <h2 id="review-heading" className="flex items-center gap-2 font-semibold text-unresolved-foreground">
        <FileTextIcon aria-hidden className="size-4" />
        Waiting for your review ({drafts.length})
      </h2>
      <p className="mt-1 text-sm text-unresolved-foreground/85">
        {drafts.length === 1 ? "This medicine isn't" : "These medicines aren't"} compared for warnings until you confirm what MedCheck read.
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
                href={draftPath(d.patientId, d)}
                className="group flex min-h-14 items-center gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-border transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{entryLabel(d.fields)}</span>
                  <span className="block truncate text-sm text-muted-foreground">{meta}</span>
                </span>
                <span className="text-sm font-semibold text-primary">Check details</span>
                <ChevronRightIcon aria-hidden className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EmptyMedicines({ hasDrafts }: { hasDrafts: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card/50 px-6 py-10 text-center">
      <PillIcon aria-hidden className="mx-auto size-6 text-muted-foreground" />
      <p className="mt-3 font-semibold">No confirmed medicines yet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground text-pretty">
        {hasDrafts
          ? "Check the details of the medicines waiting above to add them here."
          : "Take or choose a photo of a label or document."}
      </p>
    </div>
  );
}
