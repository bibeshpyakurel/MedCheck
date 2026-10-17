import { ChevronDownIcon, ChevronRightIcon, FileTextIcon, FlaskConicalIcon, HistoryIcon, PillIcon, PlusIcon, RotateCcwIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { AttentionSummary } from "@/components/checks/attention-summary";
import { HistoryList } from "@/components/records/history-list";
import { MedicationList } from "@/components/records/medication-list";
import { RecordHeader } from "@/components/records/record-header";
import { ResetDemoButton } from "@/components/records/reset-demo-button";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getFormulationsByIds } from "@/lib/catalog";
import { runChecks } from "@/lib/checks";
import { attentionSummary, checksSummaryParts } from "@/lib/checks/summary";
import { entryLabel } from "@/lib/domain/fields";
import type { MedicationEntry } from "@/lib/domain/schema";
import { DOCUMENT_KIND_LABELS, formatDocDate, INPUT_METHOD_LABELS, recordTitle } from "@/lib/record-format";
import { getPatient, listEntries, listHistory } from "@/lib/records";
import { isUuid } from "@/lib/uuid";

export async function generateMetadata({ params }: PageProps<"/patients/[patientId]">): Promise<Metadata> {
  const { patientId } = await params;
  const patient = isUuid(patientId) ? await getPatient(patientId) : null;
  return { title: patient ? recordTitle(patient) : "Record" };
}

/**
 * A person's medicines. Phone order: who · what needs attention · what's waiting · Add a medicine ·
 * the list · activity and demo tools. The full checks live on their own screen (Checks).
 */
export default async function PatientRecordPage({ params }: PageProps<"/patients/[patientId]">) {
  await requireUser();
  const { patientId } = await params;
  // Malformed ids are a 404, not a database error.
  const patient = isUuid(patientId) ? await getPatient(patientId) : null;
  if (!patient) notFound();

  const [entries, history] = await Promise.all([listEntries(patientId), listHistory(patientId)]);
  const confirmed = entries.filter((e) => e.status === "confirmed");
  const drafts = entries.filter((e) => e.status === "draft");
  const formulations = await getFormulationsByIds(confirmed.flatMap((e) => (e.formulationId ? [e.formulationId] : [])));
  const runs = runChecks({ entries: confirmed, formulations });
  const base = `/patients/${patientId}`;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <RecordHeader patient={patient} current="medicines" />

        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{recordTitle(patient)}</h1>
            <p className="mt-1 text-muted-foreground nums">{confirmed.length} on file</p>
          </div>
          <Button size="lg" className="hidden h-11 px-4 sm:inline-flex" nativeButton={false} render={<Link href={`${base}/add`} />}>
            <PlusIcon aria-hidden /> Add a medicine
          </Button>
        </header>

        <div className="mt-6 space-y-4">
          <AttentionSummary
            summary={attentionSummary(runs)}
            href={`${base}/checks`}
            compared={checksSummaryParts(runs)[0]}
          />
          {drafts.length > 0 ? <NeedsReview base={base} drafts={drafts} /> : null}
          <Button size="lg" className="h-12 w-full text-base sm:hidden" nativeButton={false} render={<Link href={`${base}/add`} />}>
            <PlusIcon aria-hidden /> Add a medicine
          </Button>
        </div>

        <section id="medicines" aria-labelledby="medicines-heading" className="mt-10 scroll-mt-24">
          <h2 id="medicines-heading" className="mb-3 text-lg font-semibold">
            Medicines
          </h2>
          {confirmed.length === 0 ? (
            <EmptyMedicines base={base} hasDrafts={drafts.length > 0} />
          ) : (
            <MedicationList patientId={patientId} entries={confirmed} />
          )}
        </section>

        <div className="mt-10 space-y-3">
          <Disclosure icon={HistoryIcon} title="Activity" hint="What was added or changed, newest first">
            <HistoryList items={history} />
          </Disclosure>
          {patient.isDemo ? (
            <Disclosure icon={FlaskConicalIcon} title="Demo tools" hint="Reset the demo household or print the demo kit">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">Presenting? Put the demo household back the way it started.</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="ghost" className="h-11 px-4" nativeButton={false} render={<Link href="/demo-kit" />}>
                    Printable demo kit
                  </Button>
                  <ResetDemoButton variant="outline" className="h-11 px-4">
                    <RotateCcwIcon aria-hidden /> Reset demo
                  </ResetDemoButton>
                </div>
              </div>
            </Disclosure>
          ) : null}
        </div>
      </div>
    </AppShell>
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

function NeedsReview({ base, drafts }: { base: string; drafts: MedicationEntry[] }) {
  return (
    <section aria-labelledby="review-heading" className="rounded-2xl border border-unresolved/35 bg-unresolved-surface/70 p-4 sm:p-5">
      <h2 id="review-heading" className="flex items-center gap-2 font-semibold text-unresolved-foreground">
        <FileTextIcon aria-hidden className="size-4" />
        Waiting for your review ({drafts.length})
      </h2>
      <p className="mt-1 text-sm text-unresolved-foreground/85">
        {drafts.length === 1 ? "This medicine isn't" : "These medicines aren't"} in the checks until you confirm what MedCheck read.
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

function EmptyMedicines({ base, hasDrafts }: { base: string; hasDrafts: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card/50 px-6 py-12 text-center">
      <PillIcon aria-hidden className="mx-auto size-6 text-muted-foreground" />
      <p className="mt-3 font-semibold">No confirmed medicines yet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground text-pretty">
        {hasDrafts
          ? "Check the details of the medicines waiting above to add them here."
          : "Scan a barcode, take a photo of a label or document, or type what the label says."}
      </p>
      {hasDrafts ? null : (
        <Button className="mt-5 h-11 px-4" nativeButton={false} render={<Link href={`${base}/add`} />}>
          <PlusIcon aria-hidden /> Add a medicine
        </Button>
      )}
    </div>
  );
}
