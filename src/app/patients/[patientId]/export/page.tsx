import { ArrowRightIcon, ClockIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { RecordHeader } from "@/components/records/record-header";
import { EmailDialog } from "@/components/report/email-form";
import { DownloadButton, EmailYourselfButton, PreviewButton, ShareButton } from "@/components/report/share-button";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getPatient } from "@/lib/records";
import { emailDraft, NO_WARNINGS, type Report } from "@/lib/report/build-report";
import { isEmailConfigured } from "@/lib/report/email-config";
import { loadReport } from "@/lib/report/load-report";

export const metadata: Metadata = { title: "Medicine report" };

function contents(report: Report): string | null {
  const n = report.medicines.length;
  if (n === 0) return null;
  const medicines = `${n} ${n === 1 ? "medicine" : "medicines"}`;
  const w = report.warnings.length;
  return w === 0 ? `${medicines}. ${NO_WARNINGS}` : `${medicines} · ${w} ${w === 1 ? "warning" : "warnings"}`;
}

export default async function ExportPage({ params }: PageProps<"/patients/[patientId]/export">) {
  const { patientId } = await params;
  await requireUser();
  if (!z.uuid().safeParse(patientId).success) notFound();
  const [patient, loaded] = await Promise.all([getPatient(patientId), loadReport(patientId)]);
  if (!patient || !loaded) notFound();
  const { report } = loaded;
  const draft = emailDraft(report);
  const share = { patientId, title: report.title, subject: draft.subject, body: draft.body };
  const configured = isEmailConfigured();
  const summary = contents(report);

  return (
    <AppShell>
      <RecordHeader patient={patient} current="report" />
      <div className="mx-auto max-w-2xl space-y-5">
        <PageHeader title="Medicine report" description="A PDF of your medicines and any warnings." />

        {report.isEmpty ? (
          <section aria-labelledby="empty-heading" className="rounded-2xl border bg-card p-5 text-center">
            <h2 id="empty-heading" className="font-semibold">
              You haven&apos;t added any medicines yet
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Once you add one, it shows up in your report.</p>
            <Button nativeButton={false} render={<Link href={`/patients/${patientId}/add`} />} className="mt-4 h-11 px-5 text-base">
              <PlusIcon aria-hidden /> Add a medicine
            </Button>
          </section>
        ) : null}

        {summary ? <p className="text-sm text-muted-foreground">In this report: {summary}</p> : null}

        {report.pendingNote ? (
          <div className="flex gap-3 rounded-xl bg-unresolved-surface p-4 text-sm text-unresolved-foreground">
            <ClockIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p>
              {report.pendingNote}{" "}
              <Link
                href={`/patients/${patientId}`}
                className="inline-flex min-h-11 items-center gap-1 font-medium underline underline-offset-4 sm:min-h-0"
              >
                Check {report.pendingCount === 1 ? "it" : "them"} now <ArrowRightIcon aria-hidden className="size-3.5" />
              </Link>
            </p>
          </div>
        ) : null}

        <section aria-label="Report actions" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <PreviewButton patientId={patientId} />
          <DownloadButton patientId={patientId} />
          <ShareButton {...share} />
          {configured ? (
            <EmailDialog patientId={patientId} defaultSubject={draft.subject} defaultBody={draft.body} />
          ) : (
            <EmailYourselfButton {...share} />
          )}
        </section>
        {configured ? null : (
          <p className="text-sm text-muted-foreground">Send by email uses your own email app.</p>
        )}
      </div>
    </AppShell>
  );
}
