// The medicine report as a page: the same Report the PDF is drawn from (report-pdf.tsx), section for
// section, so the preview works on every phone (a PDF in a frame doesn't) and in light and dark.
// Evidence only: what the labels say and the warnings found, never a dose and never "safe".
import { ActivityIcon, CircleDashedIcon, TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand";
import { NO_WARNINGS, type Report, type ReportMedicine, type ReportWarning } from "@/lib/report/build-report";

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="border-b pb-1.5 text-sm font-semibold tracking-wide text-primary uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Medicine({ medicine }: { medicine: ReportMedicine }) {
  const rows: [string, string][] = [
    ["Active ingredients", medicine.ingredients.join("; ") || "None recorded"],
    ["Form", medicine.dosageForm],
    ["Instructions", medicine.instructions],
    ["Dose as written", medicine.doseAsWritten],
    ["24-hour maximum", medicine.max24h],
  ];
  return (
    <article className="rounded-xl border bg-background/60 p-4">
      <h3 className="font-semibold text-pretty">{medicine.name}</h3>
      <p className="text-sm text-muted-foreground">{medicine.source}</p>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="sm:grid sm:grid-cols-[10rem_1fr] sm:gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="nums">{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function Warning({ warning }: { warning: ReportWarning }) {
  return (
    <article className="space-y-3 rounded-xl border border-l-4 border-finding/35 border-l-finding bg-finding-surface/60 p-4">
      <div className="flex items-start gap-2">
        <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-finding" />
        <div>
          <h3 className="font-semibold text-balance">{warning.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-pretty">{warning.detail}</p>
        </div>
      </div>
      {warning.evidence.length > 0 && (
        <ul className="divide-y divide-finding/20 border-y border-finding/20 text-sm">
          {warning.evidence.map((e, i) => (
            <li key={i} className="py-2">
              <span className="font-medium nums">
                {e.field}: {e.value}
              </span>
              <span className="block text-muted-foreground">
                {e.product} · {e.source}
              </span>
            </li>
          ))}
        </ul>
      )}
      {warning.labelWarningQuote && (
        <figure className="rounded-lg bg-card/70 p-3 ring-1 ring-finding/25">
          <figcaption className="text-xs font-semibold text-finding-foreground">The label says</figcaption>
          <blockquote className="mt-1 text-sm leading-relaxed">&ldquo;{warning.labelWarningQuote}&rdquo;</blockquote>
        </figure>
      )}
    </article>
  );
}

function NotYetConfirmed({ report }: { report: Report }) {
  if (!report.pendingNote && report.notCompared.length === 0) return null;
  return (
    <Section id="preview-pending" title="Not yet confirmed">
      <div className="flex gap-3 rounded-xl bg-unresolved-surface p-4 text-sm text-unresolved-foreground">
        <CircleDashedIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        <div className="space-y-2">
          {report.pendingNote && <p>{report.pendingNote}</p>}
          {report.notCompared.length > 0 && (
            <>
              <p>These details are missing or couldn&apos;t be read, so they weren&apos;t compared:</p>
              <ul className="list-disc space-y-1 pl-5">
                {report.notCompared.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </Section>
  );
}

/** The latest vitals scan, in neutral colours: numbers and confidence only, never a judgement. */
function Vitals({ report }: { report: Report }) {
  if (!report.vitals) return null;
  return (
    <Section id="preview-vitals" title="Vitals (estimate)">
      <div className="space-y-3 rounded-xl bg-muted p-4 text-sm">
        <p className="flex items-center gap-2 text-muted-foreground">
          <ActivityIcon aria-hidden className="size-4 shrink-0" />
          Measured {report.vitals.measuredAtLabel}
        </p>
        <dl className="space-y-2">
          {report.vitals.lines.map((l) => (
            <div key={l.label} className="grid grid-cols-[8.5rem_1fr] gap-x-4 sm:grid-cols-[10rem_1fr_auto]">
              <dt className="text-muted-foreground">{l.label}</dt>
              <dd className="font-medium nums">{l.text}</dd>
              <dd className="col-start-2 text-xs text-muted-foreground nums sm:col-start-3 sm:self-center">{l.confidence}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">{report.vitals.note}</p>
      </div>
    </Section>
  );
}

/** The report, laid out like its PDF. Its title is the page's heading. */
export function ReportPreview({ report }: { report: Report }) {
  const hasMedicines = report.medicines.length > 0;
  return (
    <article className="space-y-6 rounded-2xl border bg-card p-5 shadow-xs sm:p-8">
      <header className="space-y-4">
        <div className="flex items-center justify-between gap-3 border-b-2 border-primary pb-3">
          <BrandLogo markClassName="size-7" />
          <div className="text-right">
            <p className="text-xs font-semibold tracking-wider text-primary uppercase">Medicine report</p>
            <p className="text-xs text-muted-foreground">{report.generatedAtLabel}</p>
          </div>
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-balance">{report.title}</h1>
          {hasMedicines && (
            <p className="mt-1 text-muted-foreground nums">
              {plural(report.medicines.length, "medicine", "medicines")} ·{" "}
              {report.warnings.length === 0 ? "no warnings" : plural(report.warnings.length, "warning", "warnings")}
            </p>
          )}
        </div>
      </header>

      {report.isEmpty ? (
        <div className="rounded-xl bg-muted p-5">
          <p className="font-semibold">No medicines yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Medicines added in MedCheck will appear here, with what their labels say and any warnings.
          </p>
        </div>
      ) : (
        <>
          <Section id="preview-medicines" title="Medicines">
            {hasMedicines ? (
              report.medicines.map((m) => <Medicine key={m.id} medicine={m} />)
            ) : (
              <p className="text-muted-foreground italic">No confirmed medicines yet.</p>
            )}
          </Section>
          {hasMedicines && (
            <Section id="preview-warnings" title="Warnings">
              {report.warnings.length === 0 ? (
                <p className="text-muted-foreground italic">{NO_WARNINGS}</p>
              ) : (
                report.warnings.map((w) => <Warning key={w.id} warning={w} />)
              )}
            </Section>
          )}
          <NotYetConfirmed report={report} />
        </>
      )}
      <Vitals report={report} />

      <p className="border-t pt-4 text-sm text-muted-foreground">{report.boundary}</p>
    </article>
  );
}
