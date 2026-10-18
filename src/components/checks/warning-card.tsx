import { ChevronDownIcon, ExternalLinkIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { entrySourceHref, evidenceProvenance, officialLabelUrl } from "@/lib/checks/evidence-source";
import { DOCUMENT_KIND_LABEL, type Provenance } from "@/lib/checks/shared";
import type { Finding, FindingEvidence, Formulation, MedicationEntry } from "@/lib/domain/schema";
import { OverlapVenn } from "@/components/warnings/overlap-venn";
import { overlapVisual } from "@/lib/overlap-visual";
import { formatDocDate } from "@/lib/record-format";

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
 * One warning in plain English: what was found (title + detail), the label's own warning when there
 * is one, and — one tap away — the exact label evidence with its sources. A shared ingredient leads
 * with the overlap diagram, which shows each product's strength; its detail line moves under the
 * evidence, where it isn't a repeat.
 *
 * `label` names the kind of finding above its title ("Shared ingredient identified"); `children` add to
 * the card under the label's warning (the compare sheet's question, bars and label links);
 * `showVisual={false}` leaves out the overlap diagram when the page already draws one.
 */
export function WarningCard({
  finding,
  patientId,
  entries,
  formulations,
  label,
  headingLevel: Heading = "h3",
  showVisual = true,
  children,
}: {
  finding: Finding;
  patientId: string;
  /** The confirmed entries the checks ran on, by id. */
  entries: Map<string, MedicationEntry>;
  formulations: Record<string, Formulation>;
  label?: string;
  headingLevel?: "h3" | "h4";
  showVisual?: boolean;
  children?: ReactNode;
}) {
  const headingId = `warning-${finding.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const visual = showVisual ? overlapVisual(finding, entries) : null;
  return (
    <article
      aria-labelledby={headingId}
      className="overflow-hidden rounded-2xl border border-finding/40 bg-linear-to-b from-finding-surface/80 to-card to-60% text-card-foreground shadow-xs"
    >
      <div className="space-y-3 p-4 sm:p-5">
        {visual ? (
          <>
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-finding-foreground uppercase">
              <TriangleAlertIcon aria-hidden className="size-4 text-finding" />
              {label ?? "Shared ingredient"}
            </p>
            <OverlapVenn visual={visual} />
            <Heading id={headingId} className="font-display text-lg leading-snug font-semibold text-balance sm:text-xl">
              {finding.title}
            </Heading>
          </>
        ) : (
          <div className="flex items-start gap-3">
            <TriangleAlertIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-finding" />
            <div className="min-w-0">
              {label && <p className="mb-1 text-xs font-semibold tracking-[0.08em] text-finding-foreground uppercase">{label}</p>}
              <Heading id={headingId} className="font-display text-base leading-snug font-semibold text-balance sm:text-lg">
                {finding.title}
              </Heading>
              <p className="mt-1 leading-relaxed text-pretty text-muted-foreground">{finding.detail}</p>
            </div>
          </div>
        )}

        {finding.labelWarningQuote && (
          <figure className="rounded-xl bg-finding-surface p-3.5 ring-1 ring-finding/25">
            <figcaption className="text-sm font-semibold text-finding-foreground">The label&apos;s own warning</figcaption>
            <blockquote className="mt-1 leading-relaxed">“{finding.labelWarningQuote}”</blockquote>
          </figure>
        )}
        {children}
      </div>

      {finding.evidence.length > 0 && (
        <details className="group border-t">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-medium transition-colors active:bg-finding-surface/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:px-5 [&::-webkit-details-marker]:hidden">
            See the label evidence
            <ChevronDownIcon aria-hidden className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
          </summary>
          {visual && <p className="border-t bg-surface/50 px-4 pt-3 text-sm leading-relaxed text-pretty text-muted-foreground sm:px-5">{finding.detail}</p>}
          <ul className={visual ? "divide-y bg-surface/50" : "divide-y border-t bg-surface/50"}>
            {finding.evidence.map((e, i) => {
              const entry = entries.get(e.entryId);
              const official = officialLabelUrl(entry?.formulationId ? formulations[entry.formulationId] : undefined);
              const date = formatDocDate(e.documentDate);
              return (
                <li key={`${e.entryId}-${e.field}-${i}`} className="px-4 pt-3 text-sm sm:px-5">
                  <span className="font-medium nums">{e.text}</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    {e.entryLabel} · {sourceOf(e, evidenceProvenance(e, entry))}
                    {date ? ` · ${date}` : ""}
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
