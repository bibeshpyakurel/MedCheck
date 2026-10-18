// The comparison (spec: compare-with-my-medicines §3): the medicines side by side, Together, what the
// labels show (each finding with its label's words, a question to copy and the labels one tap away),
// what couldn't be compared, and the checks that found nothing. Never "safe", never green.
import { CircleDashedIcon } from "lucide-react";
import Link from "next/link";
import { WarningCard } from "@/components/checks/warning-card";
import { ComparedCards } from "@/components/compare/compared-cards";
import { ConcentrationBars } from "@/components/compare/concentration-bars";
import { CopyQuestion } from "@/components/compare/copy-question";
import { IngredientComparison } from "@/components/compare/ingredient-comparison";
import { LabelSheetButton } from "@/components/compare/label-sheet-button";
import type { CompareResult } from "@/app/patients/[patientId]/compare-actions";
import { comparisonView, NOT_SAFE_LINE } from "@/lib/compare-view";
import type { Finding, Formulation } from "@/lib/domain/schema";

const HEADING = "font-display text-xl font-semibold tracking-tight";

export function CompareResults({ patientId, result, onLeave }: { patientId: string; result: CompareResult; onLeave: () => void }) {
  const view = comparisonView(result);
  const entries = new Map(result.entries.map((e) => [e.id, e]));

  /** The FDA labels behind a finding's evidence, once each. */
  const labelsOf = (finding: Finding): Formulation[] => {
    const ids = [...new Set(finding.evidence.flatMap((e) => entries.get(e.entryId)?.formulationId ?? []))];
    return ids.flatMap((id) => result.formulations[id] ?? []);
  };
  const needsReview = view.cards.filter((c) => c.status === "needs_confirmation" && entries.get(c.id)?.status === "confirmed");

  return (
    <div className="space-y-8">
      <ComparedCards cards={view.cards} />

      <section aria-labelledby="compare-together" className="space-y-3">
        <h3 id="compare-together" className={HEADING}>
          Together
        </h3>
        <IngredientComparison products={view.products} />
      </section>

      <section aria-labelledby="compare-findings" className="space-y-3">
        <h3 id="compare-findings" className={HEADING}>
          What the labels show
        </h3>
        {view.findings.length === 0 && (
          <p className="rounded-2xl border bg-card px-4 py-3.5 text-pretty">Nothing found in the confirmed fields of these medicines.</p>
        )}
        {view.findings.map(({ finding, label, bars }) => {
          const labels = labelsOf(finding);
          return (
            <WarningCard
              key={finding.id}
              finding={finding}
              patientId={patientId}
              entries={entries}
              formulations={result.formulations}
              label={label}
              headingLevel="h4"
            >
              {bars && <ConcentrationBars bars={bars} />}
              <CopyQuestion question={finding.pharmacistQuestion} />
              {labels.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground">Inspect labels</p>
                  <div className="flex flex-wrap gap-2">
                    {labels.map((f) => (
                      <LabelSheetButton key={f.id} formulation={f} />
                    ))}
                  </div>
                </div>
              )}
            </WarningCard>
          );
        })}
      </section>

      {view.unresolved.length > 0 && (
        <section aria-labelledby="compare-unresolved" className="space-y-3">
          <h3 id="compare-unresolved" className={HEADING}>
            Unable to complete comparison
          </h3>
          {view.unresolved.map((u) => (
            <div key={u.check} className="space-y-2 rounded-2xl border border-unresolved/35 bg-unresolved-surface/70 p-4 text-unresolved-foreground">
              <h4 className="flex items-center gap-2 font-semibold">
                <CircleDashedIcon aria-hidden className="size-4 shrink-0" />
                {u.title}
              </h4>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                {u.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ))}
          {needsReview.map((c) => (
            <Link
              key={c.id}
              href={`/patients/${patientId}/entries/${c.id}/review?from=entry`}
              replace
              onClick={onLeave}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              Confirm the details of {c.name} →
            </Link>
          ))}
        </section>
      )}

      {view.checksRun.length > 0 && (
        <section aria-labelledby="compare-checks" className="space-y-2">
          <h3 id="compare-checks" className="font-semibold">
            Checks run
          </h3>
          <ul className="divide-y rounded-2xl border bg-card px-4">
            {view.checksRun.map((c) => (
              <li key={c.check} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-3 text-sm">
                <span>{c.title}</span>
                <span className="text-muted-foreground">{c.line}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-pretty text-muted-foreground">{NOT_SAFE_LINE}</p>
    </div>
  );
}
