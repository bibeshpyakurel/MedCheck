"use client";

import { ArrowDownIcon, CheckIcon, ChevronDownIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useId, useState, useTransition, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emptyField, formatDose, formatStrength, isFullyReviewed } from "@/lib/domain/fields";
import type { DocumentDetails } from "@/lib/ai/extract-label";
import type { EntryFields, Evidence, IngredientFields } from "@/lib/domain/schema";
import { cn } from "@/lib/utils";
import { DoseEditor, StrengthEditor, TextEditor } from "./editors";
import { FieldRow } from "./field-row";
import {
  confirmationSummary,
  groupFields,
  groupProgress,
  groupProgressLabel,
  REVIEW_GROUPS,
  reviewProgress,
  reviewStatusMessage,
  type GroupProgress,
  type ReviewGroupId,
  type ReviewSource,
} from "./review-status";

type SubmitInput = {
  patientId: string;
  entryId: string;
  fields: EntryFields;
  document: DocumentDetails | null;
  from: "entry" | null;
};
type SubmitAction = (input: SubmitInput) => Promise<{ error: string } | void>;

const text = (v: string) => v;

/** Open the first group that still needs decisions; if none do, open them all. */
function initialOpen(fields: EntryFields): Record<ReviewGroupId, boolean> {
  const first = REVIEW_GROUPS.find((g) => groupProgress(groupFields(fields, g.id)).pending > 0)?.id;
  return Object.fromEntries(REVIEW_GROUPS.map((g) => [g.id, first ? g.id === first : true])) as Record<ReviewGroupId, boolean>;
}

/**
 * One collapsible review group. Closed groups stay mounted (`hidden`), so a value being changed
 * inside one is never thrown away by opening another.
 */
function ReviewGroup({
  id,
  step,
  title,
  progress,
  open,
  onToggle,
  children,
}: {
  id: string;
  step: number;
  title: string;
  progress: GroupProgress;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const done = progress.total > 0 && progress.pending === 0;
  return (
    <section aria-labelledby={`${id}-heading`} className="scroll-mt-24 rounded-2xl border bg-card shadow-xs">
      <h2 id={`${id}-heading`}>
        <button
          id={`${id}-toggle`}
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={onToggle}
          className="flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:px-5"
        >
          <span
            aria-hidden
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold ring-1",
              done ? "bg-primary text-primary-foreground ring-primary" : "bg-card text-muted-foreground ring-border",
            )}
          >
            {done ? <CheckIcon className="size-3.5" /> : step}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-balance">{title}</span>
            <span
              className={cn(
                "block text-sm",
                progress.pending > 0 ? "text-unresolved-foreground" : "text-muted-foreground",
              )}
            >
              {groupProgressLabel(progress)}
            </span>
          </span>
          <ChevronDownIcon
            aria-hidden
            className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </button>
      </h2>
      <div id={`${id}-panel`} hidden={!open} className="border-t px-4 pb-4 sm:px-5">
        {children}
      </div>
    </section>
  );
}

export function ReviewForm({
  patientId,
  entryId,
  initialFields,
  initialDocument,
  photoUrl,
  source,
  newRowEvidence,
  confirmAction,
  saveAction,
  from = null,
}: {
  patientId: string;
  entryId: string;
  initialFields: EntryFields;
  /** null when the source has no document details to edit (e.g. a description). */
  initialDocument: DocumentDetails | null;
  photoUrl: string | null;
  /** Where the values were read from, so the choices say "the label" or "what I said". */
  source: ReviewSource;
  newRowEvidence: Evidence;
  confirmAction: SubmitAction;
  saveAction: SubmitAction;
  /** "entry": opened from the medicine's detail page; Confirm and Save for later return there. */
  from?: "entry" | null;
}) {
  const [fields, setFields] = useState(initialFields);
  const [doc, setDoc] = useState(initialDocument);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const docId = useId();

  const set = <K extends keyof EntryFields>(key: K) => (value: EntryFields[K]) => setFields((f) => ({ ...f, [key]: value }));
  // Stable React keys for ingredient rows, so removing one doesn't shift another row's edit state.
  const [rowKeys, setRowKeys] = useState(() => initialFields.ingredients.map((_, i) => i));
  const setIngredient = (index: number, patch: Partial<IngredientFields>) =>
    setFields((f) => ({ ...f, ingredients: f.ingredients.map((ing, i) => (i === index ? { ...ing, ...patch } : ing)) }));
  const addIngredient = () => {
    setRowKeys((keys) => [...keys, Math.max(-1, ...keys) + 1]);
    setFields((f) => ({
      ...f,
      ingredients: [
        ...f.ingredients,
        { name: { ...emptyField<string>(), evidence: newRowEvidence }, strength: { ...emptyField(), evidence: newRowEvidence } },
      ],
    }));
  };
  const removeIngredient = (index: number) => {
    setRowKeys((keys) => keys.filter((_, i) => i !== index));
    setFields((f) => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== index) }));
  };

  const ready = isFullyReviewed(fields);
  const { reviewed, total } = reviewProgress(fields);
  const progress = total === 0 ? 1 : reviewed / total;
  const summary = confirmationSummary(fields, source);

  const [open, setOpen] = useState(() => initialOpen(initialFields));
  const toggle = (id: ReviewGroupId) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const progressOf = (id: ReviewGroupId) => groupProgress(groupFields(fields, id));

  /** The next group (after this one, wrapping round) that still needs decisions. */
  function nextPending(id: ReviewGroupId) {
    const i = REVIEW_GROUPS.findIndex((g) => g.id === id);
    const order = [...REVIEW_GROUPS.slice(i + 1), ...REVIEW_GROUPS.slice(0, i)];
    return order.find((g) => progressOf(g.id).pending > 0) ?? null;
  }

  function goTo(from: ReviewGroupId, to: ReviewGroupId) {
    setOpen((o) => ({ ...o, [from]: false, [to]: true }));
    requestAnimationFrame(() => {
      const header = document.getElementById(`${docId}-${to}-toggle`);
      header?.scrollIntoView({ behavior: "smooth", block: "start" });
      header?.focus({ preventScroll: true });
    });
  }

  /** Shown at the end of an open group once every value in it has a decision. */
  function nextButton(id: ReviewGroupId) {
    const p = progressOf(id);
    const next = p.total > 0 && p.pending === 0 ? nextPending(id) : null;
    if (!next) return null;
    return (
      <Button type="button" className="mt-2 h-11 w-full" onClick={() => goTo(id, next.id)}>
        Next: {next.title} <ArrowDownIcon aria-hidden />
      </Button>
    );
  }

  const groupProps = (id: ReviewGroupId, step: number) => ({
    id: `${docId}-${id}`,
    step,
    title: REVIEW_GROUPS[step - 1].title,
    progress: progressOf(id),
    open: open[id],
    onToggle: () => toggle(id),
  });

  function submit(action: SubmitAction) {
    setError(null);
    startTransition(async () => {
      const result = await action({ patientId, entryId, fields, document: doc, from });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <ReviewGroup {...groupProps("medicine", 1)}>
        <div className="divide-y">
          <FieldRow
            label="Product name"
            field={fields.productName}
            onChange={set("productName")}
            format={text}
            photoUrl={photoUrl}
            source={source}
            editor={(v, setV) => <TextEditor label="Product name" value={v} onValue={setV} />}
          />
          <FieldRow
            label="Form (liquid, caplet, tablet…)"
            field={fields.dosageForm}
            onChange={set("dosageForm")}
            format={text}
            photoUrl={photoUrl}
            source={source}
            editor={(v, setV) => <TextEditor label="Form" value={v} onValue={setV} />}
          />
        </div>
        {nextButton("medicine")}
      </ReviewGroup>

      <ReviewGroup {...groupProps("ingredients", 2)}>
        {fields.ingredients.length === 0 && (
          <p className="pt-4 text-sm text-muted-foreground">
            No active ingredients read yet. Add each one {source === "label" ? "printed on the label" : "you named"}.
          </p>
        )}
        <div className="divide-y">
          {fields.ingredients.map((ing, i) => (
            <div key={rowKeys[i]}>
              <FieldRow
                label={`Ingredient ${i + 1}`}
                field={ing.name}
                onChange={(name) => setIngredient(i, { name })}
                format={text}
                photoUrl={photoUrl}
                source={source}
                editor={(v, setV) => <TextEditor label="Ingredient name" value={v} onValue={setV} />}
                actions={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    className="size-11"
                    aria-label={`Remove ingredient ${i + 1}`}
                    onClick={() => removeIngredient(i)}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                }
              />
              <FieldRow
                label={`Ingredient ${i + 1} strength`}
                field={ing.strength}
                onChange={(strength) => setIngredient(i, { strength })}
                format={formatStrength}
                photoUrl={photoUrl}
                source={source}
                className="ml-3 border-l border-dashed pl-4 sm:ml-4"
                editor={(v, setV) => <StrengthEditor value={v} onValue={setV} />}
              />
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" className="mt-2 h-11 w-full" onClick={addIngredient}>
          <PlusIcon aria-hidden /> Add an ingredient
        </Button>
        {nextButton("ingredients")}
      </ReviewGroup>

      <ReviewGroup {...groupProps("directions", 3)}>
        <div className="divide-y">
          <FieldRow
            label="Directions"
            field={fields.instructions}
            onChange={set("instructions")}
            format={text}
            photoUrl={photoUrl}
            source={source}
            editor={(v, setV) => <TextEditor label="Directions" value={v} onValue={setV} multiline />}
          />
          <FieldRow
            label="Amount in the directions"
            field={fields.doseAsWritten}
            onChange={set("doseAsWritten")}
            format={formatDose}
            photoUrl={photoUrl}
            source={source}
            editor={(v, setV) => <DoseEditor value={v} onValue={setV} />}
          />
          <FieldRow
            label="24-hour maximum"
            field={fields.max24h}
            onChange={set("max24h")}
            format={text}
            photoUrl={photoUrl}
            source={source}
            editor={(v, setV) => <TextEditor label="24-hour maximum" value={v} onValue={setV} multiline />}
          />
        </div>
        {nextButton("directions")}
      </ReviewGroup>

      {doc && (
        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-xs" aria-labelledby={`${docId}-doc`}>
          <div>
            <h2 id={`${docId}-doc`} className="text-base font-semibold">
              Document details (optional)
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Type them as printed on the label or list. Leave a box empty if it isn&apos;t there.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["documentDate", "Date on the document", "date"],
                ["facility", "Hospital or clinic", "text"],
                ["prescriber", "Prescriber", "text"],
                ["pharmacy", "Pharmacy", "text"],
              ] as const
            ).map(([key, label, type]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`${docId}-${key}`}>{label}</Label>
                <Input
                  id={`${docId}-${key}`}
                  type={type}
                  value={doc[key] ?? ""}
                  className="h-11 text-base"
                  onChange={(e) => setDoc({ ...doc, [key]: e.target.value || null })}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Sticky, not fixed: it rides the bottom of the screen while reviewing, then settles above the footer. */}
      <div className="sticky bottom-0 z-20 -mx-4 overflow-hidden border-t bg-background/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px_rgb(15_23_42/0.15)] backdrop-blur-xl sm:mx-0 sm:rounded-xl sm:border">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-0.5 origin-left bg-primary transition-transform duration-300"
          style={{ transform: `scaleX(${progress})` }}
        />
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
          <div className="sm:flex-1" aria-live="polite">
            <p className="text-sm font-medium nums">{reviewStatusMessage(fields)}</p>
            {summary ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{summary}</p>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">Every detail needs a choice before you can confirm.</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1 sm:flex-none"
              disabled={pending}
              onClick={() => submit(saveAction)}
            >
              Save for later
            </Button>
            <Button
              type="button"
              className="h-12 flex-[2] text-base sm:flex-none"
              disabled={!ready || pending}
              onClick={() => submit(confirmAction)}
            >
              {pending ? "Saving…" : "Confirm medicine"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
