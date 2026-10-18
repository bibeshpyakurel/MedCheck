import { EmailDialog } from "@/components/report/email-form";
import { DownloadButton, EmailYourselfButton, PreviewButton, ShareButton } from "@/components/report/share-button";
import { emailDraft, type Report } from "@/lib/report/build-report";

/**
 * The report's actions: Preview (left out on the preview itself), Download PDF, Share, and Send by
 * email — MedCheck's own sender (`emailConfigured`) or the person's email app. All are disabled until a
 * medicine is confirmed: until then the report has nothing in it.
 */
export function ReportActions({
  patientId,
  report,
  emailConfigured,
  preview = true,
}: {
  patientId: string;
  report: Report;
  emailConfigured: boolean;
  preview?: boolean;
}) {
  const draft = emailDraft(report);
  const share = { patientId, title: report.title, subject: draft.subject, body: draft.body };
  const disabled = report.medicines.length === 0;

  return (
    <div className="space-y-2">
      <section aria-label="Report actions" className="grid grid-cols-2 gap-2 sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none">
        {preview && <PreviewButton patientId={patientId} disabled={disabled} />}
        <DownloadButton patientId={patientId} disabled={disabled} />
        <ShareButton {...share} emailConfigured={emailConfigured} disabled={disabled} />
        {emailConfigured ? (
          <EmailDialog patientId={patientId} defaultSubject={draft.subject} defaultBody={draft.body} disabled={disabled} />
        ) : (
          <EmailYourselfButton {...share} disabled={disabled} />
        )}
      </section>
      {emailConfigured ? null : <p className="text-sm text-muted-foreground">Send by email uses your own email app.</p>}
    </div>
  );
}
