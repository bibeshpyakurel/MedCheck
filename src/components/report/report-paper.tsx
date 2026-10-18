import { ReportPreview } from "@/components/report/report-preview";
import { PreviewLink } from "@/components/report/share-button";
import type { Report } from "@/lib/report/build-report";

/**
 * What the PDF looks like, before tapping anything: the top of the report at half size on a sheet of
 * white paper (light tokens in either theme), square to the page and as wide as the actions below it.
 * A tap opens the full preview. A picture for sighted users only; Preview report is the accessible way in.
 */
export function ReportPaper({ patientId, report }: { patientId: string; report: Report }) {
  return (
    <PreviewLink patientId={patientId} className="group block">
      <div className="paper relative h-72 w-full overflow-hidden rounded-xl bg-white text-foreground shadow-lg ring-1 ring-black/5 transition-transform duration-200 group-active:scale-[0.98] sm:h-96">
        <div className="pointer-events-none w-[200%] origin-top-left scale-50 p-4 select-none">
          <ReportPreview report={report} />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-white to-transparent" />
      </div>
    </PreviewLink>
  );
}
