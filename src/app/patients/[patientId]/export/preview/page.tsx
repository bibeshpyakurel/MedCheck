import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { BackLink } from "@/components/page-header";
import { RecordHeader } from "@/components/records/record-header";
import { ReportActions } from "@/components/report/report-actions";
import { ReportPreview } from "@/components/report/report-preview";
import { requireUser } from "@/lib/auth";
import { findPatient, patientMetadata } from "@/lib/page-lookup";
import { isEmailConfigured } from "@/lib/report/email-config";
import { loadReport, timeZoneParam } from "@/lib/report/load-report";

export const generateMetadata = ({ params }: PageProps<"/patients/[patientId]/export/preview">) => patientMetadata(params, "Report preview");

/**
 * The report preview, inside MedCheck: what the PDF contains, drawn as a page (a PDF in a frame
 * doesn't work on phones), with the way back and the report's actions below. Query: `tz`, the
 * browser's time zone, so "generated at" reads in local time like the PDF.
 */
export default async function ReportPreviewPage({ params, searchParams }: PageProps<"/patients/[patientId]/export/preview">) {
  const { patientId } = await params;
  const { tz } = await searchParams;
  const user = await requireUser();
  if (!z.uuid().safeParse(patientId).success) notFound();
  const timeZone = timeZoneParam(typeof tz === "string" ? tz : undefined);
  const [patient, loaded] = await Promise.all([findPatient(patientId), loadReport(patientId, { timeZone })]);
  if (!patient || !loaded) notFound();
  // Guests send with their own email app; the in-app sender is for accounts only (see the email route).
  const configured = isEmailConfigured() && !user.isAnonymous;

  return (
    <AppShell>
      <RecordHeader patient={patient} current="report" />
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="space-y-1">
          <BackLink href={`/patients/${patientId}/export`}>Medicine report</BackLink>
          <p className="text-sm text-muted-foreground">This is what the PDF contains.</p>
        </div>
        <ReportPreview report={loaded.report} />
        <ReportActions patientId={patientId} report={loaded.report} emailConfigured={configured} preview={false} />
      </div>
    </AppShell>
  );
}
