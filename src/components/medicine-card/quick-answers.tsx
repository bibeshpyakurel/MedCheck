// Quick answers: plain questions over the label's own bullets (`quickAnswers()` picks them). Rows 1–6
// and "Took too much?" show at once; the rest sit behind "More answers". No "use client".
import { ChevronDownIcon } from "lucide-react";
import { DosingTable, LabelBullets, PoisonControlButton } from "@/components/medicine-card/label-parts";
import type { Formulation } from "@/lib/domain/schema";
import { type QuickAnswer, quickAnswers } from "@/lib/quick-answers";

export function QuickAnswers({ formulation: f }: { formulation: Formulation }) {
  const answers = quickAnswers(f);
  const primary = answers.filter((a) => a.primary);
  const more = answers.filter((a) => !a.primary);
  const id = (key: string) => `qa-${f.id}-${key}`;

  return (
    <section aria-labelledby={id("heading")} className="space-y-3">
      <div className="space-y-0.5">
        <h3 id={id("heading")} className="font-display text-lg font-semibold tracking-tight">
          Quick answers
        </h3>
        <p className="text-sm text-muted-foreground">Picked from the FDA label, in its own words.</p>
      </div>

      <div className="divide-y rounded-2xl border bg-card px-4 shadow-xs sm:px-5">
        {primary.map((a) => (
          <Answer key={a.key} answer={a} headingId={id(a.key)} />
        ))}
      </div>

      {more.length > 0 && (
        <details className="group rounded-2xl border bg-card shadow-xs">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-4 text-[0.9375rem] font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:px-5 [&::-webkit-details-marker]:hidden">
            More answers
            <ChevronDownIcon aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="divide-y border-t px-4 sm:px-5">
            {more.map((a) => (
              <Answer key={a.key} answer={a} headingId={id(a.key)} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function Answer({ answer: a, headingId }: { answer: QuickAnswer; headingId: string }) {
  return (
    <section aria-labelledby={headingId} className="space-y-2.5 py-4">
      <h4 id={headingId} className="text-sm font-semibold text-muted-foreground">
        {a.question}
      </h4>
      {a.groups ? (
        a.groups.map((g) => (
          <div key={g.heading} className="space-y-1.5">
            <p className="text-sm font-medium">{g.heading}</p>
            <LabelBullets bullets={g.bullets} />
          </div>
        ))
      ) : (
        <LabelBullets bullets={a.bullets} />
      )}
      {a.notOnLabel && <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">{a.notOnLabel}</p>}
      {a.dosageTableHtml && <DosingTable html={a.dosageTableHtml} />}
      {a.key === "overdose" && (
        <div className="pt-1">
          <PoisonControlButton />
        </div>
      )}
    </section>
  );
}
