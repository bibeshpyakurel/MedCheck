// On-screen version of the pharmacist report. Same data as the PDF (buildReport), app tokens.
import type { ReactNode } from "react";
import type { CheckStatus } from "@/lib/domain/schema";
import type { Report } from "@/lib/report/build-report";
import { cn } from "cn";
import { BrandLogo } from "@/components/brand";
import { LocalTime } from "./local-time";

const statusStyles: Record<CheckStatus, string> = {
  finding: "bg-finding-surface text-finding-foreground",
  unresolved: "bg-unresolved-surface text-unresolved-foreground",
  no_finding: "bg-muted text-muted-foreground",
  not_applicable: "bg-muted text-muted-foreground",
};

const SECTIONS = [
  { id: "r-questions", label: "Questions" },
  { id: "r-findings", label: "What the checks found" },
  { id: "r-checks", label: "Checks run" },
  { id: "r-medicines", label: "Medicines on file" },
];

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 border-b pb-2.5 text-base font-semibold tracking-tight text-primary">
      {children}
    </h2>
  );
}

export function ReportPreview({ report }: { report: Report }) {
  return (
    <article
      aria-label={report.title}
      className="rounded-2xl border bg-card p-5 text-card-foreground shadow-lg ring-1 ring-foreground/5 sm:p-10"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-primary pb-5">
        <BrandLogo />
        <div className="sm:text-right">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Pharmacist report</p>
          <p className="text-sm text-muted-foreground">
            Generated <LocalTime iso={report.generatedAt} />
          </p>
        </div>
      </header>

      <div className="mt-5">
        <p className="font-display text-3xl font-semibold tracking-tight">{report.heading}</p>
        {report.subheading && <p className="mt-1 text-muted-foreground">{report.subheading}</p>}
        {report.isDemo && (
          <span className="mt-2 inline-block rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Demo — made-up information
          </span>
        )}
      </div>

      <nav aria-label="Jump to" className="mt-5 flex flex-wrap items-center gap-x-4 text-sm">
        <span aria-hidden className="text-muted-foreground">Jump to:</span>
        <ul className="flex flex-wrap gap-x-4">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="r-questions" className="mt-4 space-y-3">
        <SectionTitle id="r-questions">Questions to ask</SectionTitle>
        <div className="rounded-xl bg-accent/60 p-4 ring-1 ring-primary/10 sm:p-5">
          {report.questions.length === 0 ? (
            <p className="text-muted-foreground italic">No questions came up from the checks run on confirmed fields.</p>
          ) : (
            <ol className="space-y-4">
              {report.questions.map((q, i) => (
                <li key={q.text} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold">{q.text}</p>
                    <p className="text-sm text-muted-foreground">{q.context}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <section aria-labelledby="r-findings" className="mt-8 space-y-3">
        <SectionTitle id="r-findings">What the checks found</SectionTitle>
        {report.findings.length === 0 ? (
          <p className="text-muted-foreground italic">No findings in confirmed fields.</p>
        ) : (
          report.findings.map((f) => (
            <div key={f.id} className="rounded-xl border border-finding/30 border-l-4 border-l-finding bg-finding-surface/70 p-4">
              <p className="text-xs font-semibold tracking-wider text-finding-foreground uppercase">{f.checkName}</p>
              <p className="mt-1 font-semibold">{f.title}</p>
              <p className="mt-1">{f.detail}</p>
              {f.evidence.length > 0 && (
                <dl className="mt-3 divide-y divide-finding/20 border-y border-finding/20 text-sm">
                  {f.evidence.map((e, i) => (
                    <div key={i} className="grid gap-x-3 py-2 sm:grid-cols-3">
                      <dt className="font-medium">{e.product}</dt>
                      <dd className="text-muted-foreground">{e.source}</dd>
                      <dd>
                        {e.field}: {e.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {f.labelWarningQuote && (
                <blockquote className="mt-3 border-l-2 border-finding/50 pl-3 text-sm">
                  <p className="font-semibold text-finding-foreground">The label says</p>
                  <p className="italic">&ldquo;{f.labelWarningQuote}&rdquo;</p>
                </blockquote>
              )}
              <p className="mt-3 text-sm">
                <span className="font-semibold">Ask: </span>
                {f.pharmacistQuestion}
              </p>
            </div>
          ))
        )}
      </section>

      <section aria-labelledby="r-checks" className="mt-8 space-y-3">
        <SectionTitle id="r-checks">Checks run</SectionTitle>
        <p className="text-muted-foreground">{report.checksSummary}</p>
        <ul className="divide-y border-y">
          {report.checks.map((c) => (
            <li key={c.check} className="grid gap-1 py-3 sm:grid-cols-[10rem_14rem_1fr] sm:gap-3">
              <span className="font-semibold">{c.name}</span>
              <span>
                <span className={cn("inline-block rounded-md px-2 py-0.5 text-xs font-semibold", statusStyles[c.status])}>
                  {c.statusLabel}
                </span>
              </span>
              <div className="text-sm">
                <p>{c.summary}</p>
                {c.reasons.length > 0 && (
                  <ul className={cn("mt-1 list-disc pl-4", c.status === "unresolved" ? "text-unresolved" : "text-muted-foreground")}>
                    {c.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="r-medicines" className="mt-8 space-y-3">
        <SectionTitle id="r-medicines">Medicines on file</SectionTitle>
        {report.medicines.length === 0 ? (
          <p className="text-muted-foreground italic">No confirmed medicines on file.</p>
        ) : (
          report.medicines.map((m) => (
            <div key={m.id} className="rounded-xl border bg-surface/50 p-4">
              <p className="font-semibold">{m.name}</p>
              <p className="text-sm text-muted-foreground">{m.source}</p>
              <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[9rem_1fr]">
                <dt className="text-muted-foreground">Active ingredients</dt>
                <dd>{m.ingredients.join("; ") || "None recorded"}</dd>
                <dt className="text-muted-foreground">Form</dt>
                <dd>{m.dosageForm}</dd>
                <dt className="text-muted-foreground">Instructions</dt>
                <dd>{m.instructions}</dd>
                <dt className="text-muted-foreground">Dose as written</dt>
                <dd>{m.doseAsWritten}</dd>
                <dt className="text-muted-foreground">24-hour maximum</dt>
                <dd>{m.max24h}</dd>
              </dl>
            </div>
          ))
        )}
        {report.unreviewedNote && <p className="text-sm text-muted-foreground">{report.unreviewedNote}</p>}
      </section>

      <aside className="mt-8 rounded-xl border border-dashed bg-surface p-4 text-sm">
        <p className="font-semibold">Evidence, not advice</p>
        <p className="mt-1 text-muted-foreground">{report.boundary}</p>
      </aside>
    </article>
  );
}
