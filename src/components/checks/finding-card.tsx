import { DOCUMENT_KIND_LABEL } from "@/lib/checks/shared";
import type { Finding, FindingEvidence } from "@/lib/domain/schema";
import { CopyQuestionButton } from "./copy-question-button";

/** "Oct 16, 2026" from an ISO date, without shifting the day across time zones. */
export function formatDocumentDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(d);
}

function sourceOf(e: FindingEvidence): string {
  if (e.documentKind) return DOCUMENT_KIND_LABEL[e.documentKind];
  if (e.evidence.kind === "database") return "Database label";
  if (e.evidence.kind === "quote") return "Your description";
  return "Medicine record";
}

export function FindingCard({ finding }: { finding: Finding }) {
  const headingId = `finding-${finding.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <article
      aria-labelledby={headingId}
      className="relative overflow-hidden rounded-xl border border-finding/35 bg-card text-card-foreground shadow-xs"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-finding" />
      <div className="space-y-4 p-4 pl-5">
        <div>
          <h4 id={headingId} className="text-base leading-snug font-semibold text-balance">
            {finding.title}
          </h4>
          <p className="mt-1.5 text-sm leading-relaxed">{finding.detail}</p>
        </div>

        {finding.evidence.length > 0 && (
          <div>
            <p className="text-[0.6875rem] font-semibold tracking-wider text-muted-foreground uppercase">Evidence</p>
            <ul className="mt-2 divide-y overflow-hidden rounded-lg border">
              {finding.evidence.map((e, i) => (
                <li key={`${e.entryId}-${e.field}-${i}`} className="bg-surface/50 px-3 py-2.5 text-sm">
                  <span className="font-medium nums">{e.text}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {e.entryLabel} · {sourceOf(e)}
                    {e.documentDate ? ` · ${formatDocumentDate(e.documentDate)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {finding.labelWarningQuote && (
          <figure>
            <figcaption className="text-[0.6875rem] font-semibold tracking-wider text-muted-foreground uppercase">
              The label&apos;s own warning
            </figcaption>
            <blockquote className="mt-2 border-l-2 border-finding pl-3 text-sm leading-relaxed italic">
              “{finding.labelWarningQuote}”
            </blockquote>
          </figure>
        )}

        <div className="rounded-lg bg-finding-surface p-3.5 ring-1 ring-finding/25">
          <p className="text-[0.6875rem] font-semibold tracking-wider text-finding-foreground uppercase">Ask a pharmacist</p>
          <p className="mt-1.5 text-base leading-snug font-medium">{finding.pharmacistQuestion}</p>
          <div className="mt-3">
            <CopyQuestionButton text={finding.pharmacistQuestion} />
          </div>
        </div>
      </div>
    </article>
  );
}
