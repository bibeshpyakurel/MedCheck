import { ChevronDownIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { entrySourceHref, evidenceProvenance, officialLabelUrl } from "@/lib/checks/evidence-source";
import { DOCUMENT_KIND_LABEL, type Provenance } from "@/lib/checks/shared";
import type { Finding, FindingEvidence, Formulation, MedicationEntry } from "@/lib/domain/schema";
import { CopyQuestionButton } from "./copy-question-button";

/** "Oct 16, 2026" from an ISO date, without shifting the day across time zones. */
export function formatDocumentDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(d);
}

function sourceOf(e: FindingEvidence, from: Provenance): string {
  if (from === "described") return "Your description";
  const source = e.documentKind
    ? DOCUMENT_KIND_LABEL[e.documentKind]
    : e.evidence.kind === "database"
      ? "Medicine listing"
      : "Medicine record";
  // A value the user typed or corrected is theirs, not the label's.
  return from === "entered" ? `${source} · You entered this` : source;
}

const LINK = "inline-flex min-h-11 items-center gap-1 text-sm font-medium underline underline-offset-4";

/**
 * One finding, each part with its own job: what it means (title + detail), the label's own warning,
 * the question to ask, and — one tap away — the exact evidence with its sources.
 */
export function FindingCard({
  finding,
  patientId,
  entries,
  formulations,
}: {
  finding: Finding;
  patientId: string;
  entries: Map<string, MedicationEntry>;
  formulations: Record<string, Formulation>;
}) {
  const headingId = `finding-${finding.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <article
      aria-labelledby={headingId}
      className="overflow-hidden rounded-2xl border border-l-4 border-finding/35 border-l-finding bg-card text-card-foreground"
    >
      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <h3 id={headingId} className="text-lg leading-snug font-semibold text-balance">
            {finding.title}
          </h3>
          <p className="mt-1 leading-relaxed text-pretty">{finding.detail}</p>
        </div>

        {finding.labelWarningQuote && (
          <figure className="rounded-xl bg-finding-surface p-3.5 ring-1 ring-finding/25">
            <figcaption className="text-sm font-semibold text-finding-foreground">The label&apos;s own warning</figcaption>
            <blockquote className="mt-1 leading-relaxed">“{finding.labelWarningQuote}”</blockquote>
          </figure>
        )}

        <div>
          <p className="text-sm font-semibold text-muted-foreground">Ask a pharmacist</p>
          <p className="mt-1 text-base leading-snug font-medium">{finding.pharmacistQuestion}</p>
          <div className="mt-3">
            <CopyQuestionButton text={finding.pharmacistQuestion} />
          </div>
        </div>
      </div>

      {finding.evidence.length > 0 && (
        <details className="group border-t">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:px-5 [&::-webkit-details-marker]:hidden">
            See the label evidence
            <ChevronDownIcon aria-hidden className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <ul className="divide-y border-t bg-surface/50">
            {finding.evidence.map((e, i) => {
              const entry = entries.get(e.entryId);
              const official = officialLabelUrl(entry?.formulationId ? formulations[entry.formulationId] : undefined);
              return (
                <li key={`${e.entryId}-${e.field}-${i}`} className="px-4 pt-3 text-sm sm:px-5">
                  <span className="font-medium nums">{e.text}</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    {e.entryLabel} · {sourceOf(e, evidenceProvenance(e, entry))}
                    {e.documentDate ? ` · ${formatDocumentDate(e.documentDate)}` : ""}
                  </span>
                  <span className="flex flex-wrap gap-x-4">
                    <Link href={entrySourceHref(patientId, e.entryId)} aria-label={`View source: ${e.entryLabel}`} className={LINK}>
                      View source
                    </Link>
                    {official && (
                      <a href={official} target="_blank" rel="noopener noreferrer" className={LINK}>
                        Official FDA label (DailyMed)
                        <ExternalLinkIcon aria-hidden className="size-3.5" />
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </article>
  );
}
