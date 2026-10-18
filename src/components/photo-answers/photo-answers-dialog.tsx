"use client";

// The photo pop-up (spec: photo answers §2–§4): a bottom sheet on phones, a centered dialog from `sm:`
// up, over the photo screen. Confirm ("Is this …?" for each medicine read) → Continue → the answer
// card or the comparison → Save to My medicines or Don't save. Closing it any other way (×, Escape,
// device Back) keeps the drafts waiting for review.
import { ArrowLeftIcon, HeartPulseIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  discardPhotoAction,
  photoMatchesAction,
  previewPicksAction,
  savePicksAction,
  type AnswerError,
} from "@/app/patients/[patientId]/add/photo/answer-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useBackToClose } from "@/components/use-back-to-close";
import type { Formulation } from "@/lib/domain/schema";
import { confirmLayout, initialChoice, picksFrom, type ChoiceState, type PhotoMatchItem, type PhotoPick } from "@/lib/photo-answers";
import { AnswerResult, answersFor } from "./answer-result";
import { choiceQuestion, MedicineChoice } from "./medicine-choice";

const OFFLINE: AnswerError = { error: "Something went wrong. Check your connection and try again." };

/**
 * A redirecting action's promise rejects with Next's redirect signal while the router navigates:
 * null for that (nothing to show), OFFLINE for a real failure.
 */
function failedOrNavigating(error: unknown): AnswerError | null {
  try {
    unstable_rethrow(error);
  } catch {
    return null;
  }
  return OFFLINE;
}

type Busy = "continue" | "save" | "vitals" | "discard" | null;

const onOverlayEntry = () => typeof (window.history.state as Record<string, unknown> | null)?.medcheckOverlay === "number";

/**
 * Steps back over this pop-up's history entries, so that a redirect replaces the photo page itself
 * (Back then skips the finished photo) and nothing is left for device Back to "close".
 */
async function leaveOverlayEntries(): Promise<void> {
  for (let i = 0; i < 4 && onOverlayEntry(); i++) {
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        window.removeEventListener("popstate", done);
        resolve();
      };
      const timer = setTimeout(done, 1000);
      window.addEventListener("popstate", done);
      window.history.back();
    });
  }
}

export function PhotoAnswersDialog({
  patientId,
  sourceDocumentId,
  photoUrl,
  onClose,
  onDiscarded,
}: {
  patientId: string;
  sourceDocumentId: string;
  /** The photo as taken (a local object URL), shown small beside the question. */
  photoUrl: string | null;
  /** Closed without Save or Don't save: the drafts stay waiting for review. */
  onClose: () => void;
  /** Cancel or Don't save finished: what was read is gone. */
  onDiscarded: () => void;
}) {
  const [items, setItems] = useState<PhotoMatchItem[] | null>(null);
  const [states, setStates] = useState<ChoiceState[]>([]);
  const [result, setResult] = useState<{ picks: PhotoPick[]; formulations: Formulation[] } | null>(null);
  // "steps" layout: which medicine is showing.
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<AnswerError | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  // While leaving (Save, Don't save, close) the history entries are stepped over first; Back is ignored.
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);

  // Device Back: from the result to Confirm; from Confirm out of the pop-up (drafts kept).
  useBackToClose(!leaving, () => {
    if (!leavingRef.current) void close();
  });
  useBackToClose(!leaving && result !== null, () => {
    if (!leavingRef.current) setResult(null);
  });

  useEffect(() => {
    let live = true;
    photoMatchesAction({ patientId, sourceDocumentId })
      .catch(() => OFFLINE)
      .then((r) => {
        if (!live) return;
        if ("error" in r) return setError(r);
        setItems(r.items);
        setStates(r.items.map((item) => ({ entryId: item.entryId, choice: initialChoice(item), removed: false })));
      });
    return () => {
      live = false;
    };
  }, [patientId, sourceDocumentId]);

  async function leave(): Promise<void> {
    leavingRef.current = true;
    await leaveOverlayEntries();
    setLeaving(true);
  }

  /** Back in the pop-up after a failed Save or Don't save: its history entries again, Back works again. */
  function stay() {
    leavingRef.current = false;
    setLeaving(false);
  }

  async function close() {
    if (busy) return;
    await leave();
    onClose();
  }

  async function continueToResult() {
    const picks = picksFrom(states);
    if (!picks) return;
    setError(null);
    setBusy("continue");
    const r = await previewPicksAction({ patientId, sourceDocumentId, picks }).catch(() => OFFLINE);
    setBusy(null);
    if ("error" in r) return setError(r);
    setResult({ picks, formulations: r.formulations });
  }

  /** Save to My medicines, or Save with vitals (`then: "vitals"`: the vitals scan follows). */
  async function save(then?: "vitals") {
    if (!result) return;
    setError(null);
    setBusy(then ?? "save");
    await leave();
    // On success the action redirects to My medicines (or the vitals scan), replacing the photo page.
    const r = await savePicksAction({ patientId, sourceDocumentId, picks: result.picks, then }).catch(failedOrNavigating);
    if (r?.error) {
      stay();
      setBusy(null);
      setError(r);
    }
  }

  async function discard() {
    setError(null);
    setBusy("discard");
    await leave();
    const r = await discardPhotoAction({ patientId, sourceDocumentId }).catch(() => OFFLINE);
    if (r?.error) {
      stay();
      setBusy(null);
      return setError(r);
    }
    onDiscarded();
  }

  const layout = confirmLayout(items?.length ?? 0);
  const picks = picksFrom(states);
  const answers = result ? answersFor(result.picks, result.formulations) : null;
  const pending = busy !== null;

  let title: ReactNode;
  if (answers) title = answers.length === 1 ? answers[0].title : `${answers.length} medicines from this photo`;
  else if (!items) title = error ? "We couldn't look up this photo" : "Finding it in the FDA list…";
  else if (layout === "one") title = choiceQuestion(items[0], states[0].choice);
  else title = `${items.length} medicines in this photo`;

  const row = (item: PhotoMatchItem, i: number) => (
    <MedicineChoice
      key={item.entryId}
      item={item}
      state={states[i]}
      position={layout === "one" ? null : { n: i + 1, total: items!.length }}
      disabled={pending}
      onChange={(next) => setStates((all) => all.map((s, j) => (j === i ? { ...s, ...next } : s)))}
    />
  );
  // "steps": the medicine showing must have a choice (or be removed) before the next one.
  const current = states[index];
  const currentDone = current ? current.removed || picksFrom([current]) !== null : false;
  const lastStep = index >= (items?.length ?? 1) - 1;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) void close();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-auto bottom-0 left-0 flex max-h-[92dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-t-2xl rounded-b-none p-0 max-sm:data-open:slide-in-from-bottom-8 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[85dvh] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start gap-1 border-b py-2 pr-2 pl-2">
          {answers ? (
            <Button variant="ghost" size="icon" className="size-11" disabled={pending} onClick={() => setResult(null)}>
              <ArrowLeftIcon aria-hidden className="size-5" />
              <span className="sr-only">Back to the medicines in this photo</span>
            </Button>
          ) : (
            <span aria-hidden className="w-3" />
          )}
          <DialogTitle className="min-w-0 flex-1 py-2.5 text-xl font-normal text-balance [&:not(:has(strong))]:font-semibold">{title}</DialogTitle>
          <DialogClose disabled={pending} render={<Button variant="ghost" size="icon" className="size-11" />}>
            <XIcon aria-hidden className="size-5" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5">
          {!answers && (
            <div className="flex items-start gap-4">
              <DialogDescription className="min-w-0 flex-1 text-base leading-relaxed text-pretty">
                {!items
                  ? error
                    ? "What MedCheck read is still waiting for review on My medicines."
                    : "MedCheck read your photo and is looking it up in the FDA list."
                  : layout === "one"
                    ? "Check the name and strength against the package. Nothing is saved yet."
                    : "Check each one against its package, then Continue. Nothing is saved yet."}
              </DialogDescription>
              {photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL
                <img src={photoUrl} alt="Your photo" className="size-16 shrink-0 rounded-xl border bg-surface object-cover shadow-xs" />
              )}
            </div>
          )}

          {!items && !error && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircleIcon aria-hidden className="size-4 animate-spin" /> Looking it up…
            </p>
          )}

          {answers ? (
            <>
              <DialogDescription className="sr-only">Nothing is saved yet.</DialogDescription>
              <AnswerResult answers={answers} patientId={patientId} />
            </>
          ) : (
            items &&
            (layout === "steps" ? (
              <div className="space-y-3">
                {row(items[index], index)}
              </div>
            ) : (
              <div className="space-y-3">{items.map(row)}</div>
            ))
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription className="space-y-3">
                <p>{error.error}</p>
                {(error.gone || !items) && (
                  <Button variant="outline" className="h-11 px-4" nativeButton={false} render={<Link href={`/patients/${patientId}`} replace />}>
                    Go to My medicines
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t bg-muted/50 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:flex-wrap sm:justify-end">
          {answers ? (
            <>
              {/* Three buttons fill the row from sm:, so the note takes a line of its own above them. */}
              <p className="self-center text-sm text-muted-foreground sm:basis-full">Nothing is saved yet.</p>
              <Button variant="outline" className="h-11 px-4 text-base" disabled={pending} onClick={discard}>
                {busy === "discard" ? <BusyLabel>Discarding…</BusyLabel> : "Don't save"}
              </Button>
              <Button variant="outline" className="h-11 px-4 text-base" disabled={pending} onClick={() => save("vitals")}>
                {busy === "vitals" ? (
                  <BusyLabel>Saving…</BusyLabel>
                ) : (
                  <>
                    <HeartPulseIcon aria-hidden /> Save with vitals
                  </>
                )}
              </Button>
              <Button className="h-11 px-5 text-base" disabled={pending} onClick={() => save()}>
                {busy === "save" ? <BusyLabel>Saving…</BusyLabel> : "Save to My medicines"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="h-11 px-4 text-base" disabled={pending} onClick={discard}>
                {busy === "discard" ? <BusyLabel>Discarding…</BusyLabel> : "Cancel"}
              </Button>
              {layout === "steps" && index > 0 && (
                <Button variant="ghost" className="h-11 px-4 text-base" disabled={pending} onClick={() => setIndex((i) => i - 1)}>
                  Previous medicine
                </Button>
              )}
              {layout === "steps" && !lastStep ? (
                <Button className="h-11 px-5 text-base" disabled={pending || !currentDone} onClick={() => setIndex((i) => i + 1)}>
                  Next medicine
                </Button>
              ) : (
                <Button className="h-11 px-5 text-base" disabled={pending || !picks} onClick={continueToResult}>
                  {busy === "continue" ? <BusyLabel>Opening…</BusyLabel> : "Continue"}
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BusyLabel({ children }: { children: ReactNode }) {
  return (
    <>
      <LoaderCircleIcon aria-hidden className="animate-spin" /> {children}
    </>
  );
}
