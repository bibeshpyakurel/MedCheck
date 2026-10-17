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
      className="rounded-xl border border-finding/40 border-l-4 border-l-finding bg-card p-4 text-card-foreground"
    >
      <h4 id={headingId} className="text-base font-semibold leading-snug">
        {finding.title}
      </h4>
      <p className="mt-2 text-sm leading-relaxed">{finding.detail}</p>

      {finding.evidence.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Evidence</p>
          <ul className="mt-1 space-y-2">
            {finding.evidence.map((e, i) => (
              <li key={`${e.entryId}-${e.field}-${i}`} className="rounded-lg bg-muted px-3 py-2 text-sm">
                <span className="font-medium">{e.text}</span>
                <span className="block text-xs text-muted-foreground">
                  {e.entryLabel} · {sourceOf(e)}
                  {e.documentDate ? ` · ${formatDocumentDate(e.documentDate)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {finding.labelWarningQuote && (
        <figure className="mt-3">
          <figcaption className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            The label&apos;s own warning
          </figcaption>
          <blockquote className="mt-1 border-l-2 border-finding pl-3 text-sm italic leading-relaxed">
            “{finding.labelWarningQuote}”
          </blockquote>
        </figure>
      )}

      <div className="mt-4 rounded-lg bg-finding-surface p-3 text-finding-foreground">
        <p className="text-xs font-semibold tracking-wide uppercase">Ask a pharmacist</p>
        <p className="mt-1 text-base font-medium leading-snug">{finding.pharmacistQuestion}</p>
        <div className="mt-3">
          <CopyQuestionButton text={finding.pharmacistQuestion} />
        </div>
      </div>
    </article>
  );
}
