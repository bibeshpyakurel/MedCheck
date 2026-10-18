"use client";

import { ChevronDownIcon } from "lucide-react";
import { useId, useState } from "react";
import { CompareButton } from "@/components/compare/compare-button";
import { IngredientComparison } from "@/components/compare/ingredient-comparison";
import { MedicineCard } from "@/components/medicine-card/medicine-card";
import type { Formulation } from "@/lib/domain/schema";
import type { PhotoPick } from "@/lib/photo-answers";
import { cn } from "@/lib/utils";

type Answer = { key: string; title: string; formulation: Formulation | null };

/** The picks in photo order, each with its FDA label (null: saved by the typed name only). */
export function answersFor(picks: PhotoPick[], formulations: Formulation[]): Answer[] {
  const byId = new Map(formulations.map((f) => [f.id, f]));
  return picks.map((p) =>
    "formulationId" in p
      ? { key: p.entryId, title: byId.get(p.formulationId)?.brandName ?? "Medicine", formulation: byId.get(p.formulationId) ?? null }
      : { key: p.entryId, title: p.typedName, formulation: null },
  );
}

/**
 * After Continue, before anything is saved: one medicine → its answer card; two or more → **Together**
 * (the ingredient comparison) first, then each medicine's card, stacked and collapsible.
 */
export function AnswerResult({ answers, patientId }: { answers: Answer[]; patientId: string }) {
  if (answers.length === 1) return <AnswerBody answer={answers[0]} patientId={patientId} />;
  const compared = answers.flatMap((a) => (a.formulation ? [a.formulation] : []));
  return (
    <div className="space-y-8">
      <section aria-labelledby="together" className="space-y-3">
        <h3 id="together" className="font-display text-xl font-semibold tracking-tight">
          Together
        </h3>
        {compared.length >= 2 ? (
          <IngredientComparison products={compared} />
        ) : (
          <p className="text-sm text-muted-foreground text-pretty">
            Only medicines found in the FDA list are compared, and fewer than two were found.
          </p>
        )}
      </section>
      <section aria-labelledby="each-medicine" className="space-y-3">
        <h3 id="each-medicine" className="font-display text-xl font-semibold tracking-tight">
          Each medicine
        </h3>
        <ul className="space-y-3">
          {answers.map((a) => (
            <li key={a.key}>
              <Collapsible title={a.title}>
                <AnswerBody answer={a} patientId={patientId} />
              </Collapsible>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** A matched medicine's card, which can also be compared with the person's saved medicines (nothing is saved). */
function AnswerBody({ answer, patientId }: { answer: Answer; patientId: string }) {
  if (answer.formulation)
    return (
      <MedicineCard
        formulation={answer.formulation}
        showTitle={false}
        actions={<CompareButton patientId={patientId} subject={{ entryId: answer.key, formulationId: answer.formulation.id }} />}
      />
    );
  return (
    <p className="rounded-xl border bg-surface p-4 text-sm text-pretty">
      <span className="font-semibold">{answer.title}</span> isn&apos;t matched to an FDA label, so there is no card. It is saved by its
      name only; its strength and other details stay unknown, so checks that need them can&apos;t run.
    </p>
  );
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="rounded-2xl border bg-card shadow-xs">
      <h4>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-semibold text-pretty focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="min-w-0 flex-1">{title}</span>
          <ChevronDownIcon aria-hidden className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
      </h4>
      <div id={id} hidden={!open} className="border-t px-4 py-5">
        {children}
      </div>
    </div>
  );
}
