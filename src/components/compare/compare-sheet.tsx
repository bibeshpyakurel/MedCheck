"use client";

// Compare with my medicines (spec §3): one sheet, two steps. Pick: this medicine, the person's other
// medicines to tick, and what each picked one says (and what still needs confirming). Results: the
// existing checks over them. Device Back steps from results to picking, then closes. Saves nothing.
import { ArrowLeftIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { Fragment, useState, useTransition } from "react";
import { compareMedicinesAction, type CompareChoices, type CompareResult } from "@/app/patients/[patientId]/compare-actions";
import { CompareResults } from "@/components/compare/compare-results";
import { StatusChip } from "@/components/compare/compared-cards";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useBackToClose } from "@/components/use-back-to-close";
import type { CompareSubject, MedicineSummary } from "@/lib/compare-view";
import { cn } from "@/lib/utils";

const FAILED = "Couldn't compare these medicines. Try again.";

/** "Acetaminophen 100 mg per 5 mL · liquid" */
function summaryLine(m: MedicineSummary): string {
  const ingredients = m.ingredients.map((i) => [i.name, i.strength].filter(Boolean).join(" ")).join(", ");
  return [ingredients, m.form].filter(Boolean).join(" · ");
}

function NeedsConfirmation() {
  return <span className="ml-1.5 text-xs font-semibold text-unresolved-foreground">Needs confirmation</span>;
}

export function CompareSheet({
  patientId,
  subject,
  choices,
  open,
  onOpenChange,
}: {
  patientId: string;
  subject: CompareSubject;
  choices: CompareChoices;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [step, setStep] = useState<"pick" | "results">("pick");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const close = () => {
    onOpenChange(false);
    setStep("pick");
  };
  const release = useBackToClose(open, close);
  useBackToClose(open && step === "results", () => setStep("pick"));

  const chosen = choices.options.filter((o) => picked.includes(o.id));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  function compare() {
    setResult(null);
    setError(null);
    setStep("results");
    startTransition(async () => {
      const r = await compareMedicinesAction({ patientId, subject, entryIds: picked }).catch(() => ({ error: FAILED }));
      if ("error" in r) setError(r.error);
      else setResult(r);
    });
  }

  const s = choices.subject;
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent
        showCloseButton={false}
        className="top-auto bottom-0 left-0 flex max-h-[92dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-t-2xl rounded-b-none p-0 max-sm:data-open:slide-in-from-bottom-8 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[85dvh] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start gap-1 border-b py-2 pr-2 pl-2">
          {step === "results" ? (
            <Button variant="ghost" size="icon" className="size-11" onClick={() => setStep("pick")}>
              <ArrowLeftIcon aria-hidden className="size-5" />
              <span className="sr-only">Change the medicines to compare</span>
            </Button>
          ) : (
            <span aria-hidden className="w-3" />
          )}
          <DialogTitle className="min-w-0 flex-1 py-2.5 text-xl text-balance">Compare with my medicines</DialogTitle>
          <DialogClose render={<Button variant="ghost" size="icon" className="size-11" />}>
            <XIcon aria-hidden className="size-5" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5">
          <DialogDescription className="text-base leading-relaxed text-pretty">
            MedCheck lines up what the labels say. It never says a combination is safe.
          </DialogDescription>

          {step === "pick" ? (
            <>
              <section aria-labelledby="compare-this" className="space-y-2">
                <h3 id="compare-this" className="text-sm font-semibold text-muted-foreground">
                  This medicine
                </h3>
                <div className="space-y-0.5 rounded-2xl border border-primary/20 bg-accent p-4 text-accent-foreground">
                  <p className="font-semibold text-foreground">{s.name}</p>
                  <p className="text-sm">{summaryLine(s)}</p>
                  {s.fictional && <p className="text-sm">Fictional demo label, not a real product</p>}
                </div>
              </section>

              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-semibold text-muted-foreground">Compare with (pick one or more)</legend>
                <ul className="space-y-2">
                  {choices.options.map((o) =>
                    o.status === "waiting_for_review" ? (
                      <li key={o.id} className="flex items-start gap-3 rounded-xl border bg-muted/40 p-3.5">
                        <input type="checkbox" disabled aria-label={`${o.name} (waiting for review)`} className="mt-0.5 size-5 shrink-0" />
                        <span className="min-w-0 flex-1 space-y-1">
                          <span className="block font-medium">{o.name}</span>
                          <span className="block text-sm text-muted-foreground">{summaryLine(o)}</span>
                          <StatusChip status={o.status} />
                          <span className="block text-sm text-muted-foreground">
                            Confirm what MedCheck read before comparing it.{" "}
                            <Link href={`/patients/${patientId}/entries/${o.id}`} replace onClick={release} className="font-semibold text-primary underline-offset-4 hover:underline">
                              Check details
                            </Link>
                          </span>
                        </span>
                      </li>
                    ) : (
                      <li key={o.id}>
                        <label
                          className={cn(
                            "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border bg-card p-3.5 transition-colors",
                            picked.includes(o.id) && "border-primary/50 bg-accent/60",
                          )}
                        >
                          <input type="checkbox" checked={picked.includes(o.id)} onChange={() => toggle(o.id)} className="mt-0.5 size-5 shrink-0 accent-primary" />
                          <span className="min-w-0 flex-1 space-y-1">
                            <span className="block font-medium">{o.name}</span>
                            <span className="block text-sm text-muted-foreground">{summaryLine(o)}</span>
                            <StatusChip status={o.status} />
                          </span>
                        </label>
                      </li>
                    ),
                  )}
                </ul>
              </fieldset>

              {chosen.length > 0 && (
                <section aria-labelledby="compare-check" className="space-y-2">
                  <h3 id="compare-check" className="text-sm font-semibold text-muted-foreground">
                    Check before comparing
                  </h3>
                  <p className="text-sm text-pretty text-muted-foreground">
                    Only confirmed values are compared. A value that needs confirmation makes the comparison that needs it unable to complete.
                  </p>
                  {chosen.map((o) => (
                    <div key={o.id} className="space-y-2 rounded-xl border bg-card p-3.5">
                      <p className="font-medium">{o.name}</p>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                        {o.ingredients.map((i, n) => (
                          <Fragment key={n}>
                            <dt className="text-muted-foreground">Ingredient</dt>
                            <dd>
                              {i.name}
                              {i.strength ? `, ${i.strength}` : ""}
                              {i.state === "needs_confirmation" && <NeedsConfirmation />}
                            </dd>
                          </Fragment>
                        ))}
                        <dt className="text-muted-foreground">Form</dt>
                        <dd>
                          {o.form ?? "Not given"}
                          {o.formState === "needs_confirmation" && <NeedsConfirmation />}
                        </dd>
                      </dl>
                      {o.status === "needs_confirmation" && (
                        <Link
                          href={`/patients/${patientId}/entries/${o.id}/review?from=entry`}
                          replace
                          onClick={release}
                          className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
                        >
                          Review it →
                        </Link>
                      )}
                    </div>
                  ))}
                </section>
              )}
            </>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription className="space-y-3">
                <p>{error}</p>
                <Button variant="outline" className="h-11 px-4" onClick={compare}>
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          ) : result ? (
            <CompareResults patientId={patientId} result={result} onLeave={release} />
          ) : (
            <div role="status" aria-label="Comparing" className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-40 rounded-2xl" />
                <Skeleton className="h-40 rounded-2xl" />
              </div>
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t bg-muted/50 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
          {step === "pick" ? (
            <Button className="h-11 px-5 text-base" disabled={picked.length === 0 || pending} onClick={compare}>
              {pending ? (
                <>
                  <LoaderCircleIcon aria-hidden className="animate-spin" /> Comparing…
                </>
              ) : picked.length === 0 ? (
                "Pick a medicine to compare"
              ) : (
                `Compare ${picked.length + 1} medicines`
              )}
            </Button>
          ) : (
            <>
              <Button variant="outline" className="h-11 px-4 text-base" onClick={() => setStep("pick")}>
                Change medicines
              </Button>
              <Button className="h-11 px-5 text-base" onClick={close}>
                Done
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
