import { MailIcon, SendIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { EmailForm } from "@/components/report/email-form";
import { ReportPreview } from "@/components/report/report-preview";
import { DownloadButton, ShareButton } from "@/components/report/share-button";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { emailDraft } from "@/lib/report/build-report";
import { isEmailConfigured } from "@/lib/report/email-config";
import { loadReport } from "@/lib/report/load-report";

export const metadata: Metadata = { title: "Pharmacist report" };

export default async function ExportPage({ params }: PageProps<"/patients/[patientId]/export">) {
  const { patientId } = await params;
  await requireUser();
  if (!z.uuid().safeParse(patientId).success) notFound();
  const loaded = await loadReport(patientId);
  if (!loaded) notFound();
  const { report } = loaded;
  const draft = emailDraft(report);
  const configured = isEmailConfigured();

  const share = (
    <ShareButton patientId={patientId} title={report.title} subject={draft.subject} body={draft.body} className="w-full" />
  );

  return (
    <AppShell mobileActionBar>
      <div>
        <PageHeader
          back={{ href: `/patients/${patientId}`, label: <>Back to {report.isSelf ? "my medicines" : report.patientName}</> }}
          title="Pharmacist report"
          description="Bring this to a pharmacist or doctor, or send it ahead. It shows what the labels and documents say and the questions to ask."
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <ReportPreview report={report} />

          <aside className="space-y-5 lg:sticky lg:top-24">
            {/* Phones: a sticky bar at the bottom. Wider screens: a regular panel beside the preview. */}
            <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:rounded-2xl sm:border sm:bg-card sm:p-5 sm:shadow-xs">
              <p className="mb-1 hidden items-center gap-2 font-semibold sm:flex">
                <SendIcon aria-hidden className="size-4 text-primary" /> Send or save
              </p>
              <p className="mb-4 hidden text-sm text-muted-foreground sm:block">A PDF with the same content as this preview.</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-1">
                {share}
                <DownloadButton patientId={patientId} className="w-full" />
                <Button
                  nativeButton={false}
                  render={<a href="#email" />}
                  variant="outline"
                  className="h-11 w-full px-2 text-sm sm:hidden"
                >
                  <MailIcon aria-hidden /> Email
                </Button>
              </div>
            </div>

            <section id="email" aria-labelledby="email-heading" className="scroll-mt-24 rounded-2xl border bg-card p-5 shadow-xs">
              <h2 id="email-heading" className="mb-4 flex items-center gap-2 font-semibold">
                <MailIcon aria-hidden className="size-4 text-primary" />
                Email the report
              </h2>
              <EmailForm
                patientId={patientId}
                defaultSubject={draft.subject}
                defaultBody={draft.body}
                configured={configured}
              />
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
