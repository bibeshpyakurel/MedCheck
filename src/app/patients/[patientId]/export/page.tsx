import { SendIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { RecordHeader } from "@/components/records/record-header";
import { EmailDialog, EmailUnavailable } from "@/components/report/email-form";
import { ReportPreview } from "@/components/report/report-preview";
import { DownloadButton, ShareButton } from "@/components/report/share-button";
import { requireUser } from "@/lib/auth";
import { getPatient } from "@/lib/records";
import { emailDraft } from "@/lib/report/build-report";
import { isEmailConfigured } from "@/lib/report/email-config";
import { loadReport } from "@/lib/report/load-report";

export const metadata: Metadata = { title: "Pharmacist report" };

export default async function ExportPage({ params }: PageProps<"/patients/[patientId]/export">) {
  const { patientId } = await params;
  await requireUser();
  if (!z.uuid().safeParse(patientId).success) notFound();
  const [patient, loaded] = await Promise.all([getPatient(patientId), loadReport(patientId)]);
  if (!patient || !loaded) notFound();
  const { report } = loaded;
  const draft = emailDraft(report);
  const configured = isEmailConfigured();

  return (
    <AppShell>
      <RecordHeader patient={patient} current="report" />
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          title="Pharmacist report"
          description="Bring this to a pharmacist or doctor, or send it ahead. It shows what the labels and documents say and the questions to ask."
        />

        {/* The one place to share or save, in the page flow (never fixed over the footer or a focused field). */}
        <section aria-labelledby="share-heading" className="rounded-2xl border bg-card p-4 sm:p-5">
          <h2 id="share-heading" className="flex items-center gap-2 font-semibold">
            <SendIcon aria-hidden className="size-4 text-primary" /> Share or save
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">A PDF with everything in the report below.</p>
          <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
            <ShareButton
              patientId={patientId}
              title={report.title}
              subject={draft.subject}
              body={draft.body}
              className="sm:w-40"
            />
            <DownloadButton patientId={patientId} className="w-full sm:w-auto sm:px-4" />
            {configured ? (
              <EmailDialog
                patientId={patientId}
                defaultSubject={draft.subject}
                defaultBody={draft.body}
                className="h-11 w-full text-base sm:w-auto sm:px-4"
              />
            ) : null}
          </div>
          {configured ? null : (
            <div className="mt-3">
              <EmailUnavailable />
            </div>
          )}
        </section>

        <ReportPreview report={report} />
      </div>
    </AppShell>
  );
}
