import { ExternalLinkIcon } from "lucide-react";
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
      ? "Database label"
      : "Medicine record";
  // A value the user typed or corrected is theirs, not the label's.
  return from === "entered" ? `${source} · You entered this` : source;
}

const LINK = "inline-flex min-h-11 items-center gap-1 text-sm font-medium underline underline-offset-4";

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
              {finding.evidence.map((e, i) => {
                const entry = entries.get(e.entryId);
                const official = officialLabelUrl(entry?.formulationId ? formulations[entry.formulationId] : undefined);
                return (
                  <li key={`${e.entryId}-${e.field}-${i}`} className="bg-surface/50 px-3 pt-2.5 text-sm">
                    <span className="font-medium nums">{e.text}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
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
