"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emptyField, formatDose, formatStrength, isFullyReviewed } from "@/lib/domain/fields";
import type { DocumentDetails } from "@/lib/ai/extract-label";
import type { EntryFields, Evidence, Field, IngredientFields } from "@/lib/domain/schema";
import { DoseEditor, StrengthEditor, TextEditor } from "./editors";
import { FieldRow } from "./field-row";

type SubmitInput = { patientId: string; entryId: string; fields: EntryFields; document: DocumentDetails | null };
type SubmitAction = (input: SubmitInput) => Promise<{ error: string } | void>;

const text = (v: string) => v;

function countPending(fields: EntryFields): number {
  const all: Field<unknown>[] = [
    fields.productName,
    fields.dosageForm,
    fields.instructions,
    fields.doseAsWritten,
    fields.max24h,
    ...fields.ingredients.flatMap((i) => [i.name, i.strength] as Field<unknown>[]),
  ];
  return all.filter((f) => f.state === "pending").length;
}

export function ReviewForm({
  patientId,
  entryId,
  initialFields,
  initialDocument,
  photoUrl,
  newRowEvidence,
  confirmAction,
  saveAction,
}: {
  patientId: string;
  entryId: string;
  initialFields: EntryFields;
  /** null when the source has no document details to edit (e.g. a description). */
  initialDocument: DocumentDetails | null;
  photoUrl: string | null;
  newRowEvidence: Evidence;
  confirmAction: SubmitAction;
  saveAction: SubmitAction;
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
  const remaining = countPending(fields);

  function submit(action: SubmitAction) {
    setError(null);
    startTransition(async () => {
      const result = await action({ patientId, entryId, fields, document: doc });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-6 pb-28">
      <section className="space-y-3" aria-labelledby={`${docId}-medicine`}>
        <h2 id={`${docId}-medicine`} className="text-lg font-semibold">
          Medicine
        </h2>
        <FieldRow
          label="Product name"
          field={fields.productName}
          onChange={set("productName")}
          format={text}
          photoUrl={photoUrl}
          editor={(v, setV) => <TextEditor label="Product name" value={v} onValue={setV} />}
        />
        <FieldRow
          label="Form (liquid, caplet, tablet…)"
          field={fields.dosageForm}
          onChange={set("dosageForm")}
          format={text}
          photoUrl={photoUrl}
          editor={(v, setV) => <TextEditor label="Form" value={v} onValue={setV} />}
        />
      </section>

      <section className="space-y-3" aria-labelledby={`${docId}-ingredients`}>
        <h2 id={`${docId}-ingredients`} className="text-lg font-semibold">
          Active ingredients
        </h2>
        {fields.ingredients.length === 0 && (
          <p className="text-sm text-muted-foreground">No active ingredients read. Add each one printed on the label.</p>
        )}
        {fields.ingredients.map((ing, i) => (
          <div key={rowKeys[i]} className="space-y-2 rounded-2xl border border-dashed p-2">
            <FieldRow
              label={`Ingredient ${i + 1}`}
              field={ing.name}
              onChange={(name) => setIngredient(i, { name })}
              format={text}
              photoUrl={photoUrl}
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
              editor={(v, setV) => <StrengthEditor value={v} onValue={setV} />}
            />
          </div>
        ))}
        <Button type="button" variant="outline" className="h-11 w-full" onClick={addIngredient}>
          <PlusIcon aria-hidden /> Add an ingredient
        </Button>
      </section>

      <section className="space-y-3" aria-labelledby={`${docId}-directions`}>
        <h2 id={`${docId}-directions`} className="text-lg font-semibold">
          Directions
        </h2>
        <FieldRow
          label="Directions"
          field={fields.instructions}
          onChange={set("instructions")}
          format={text}
          photoUrl={photoUrl}
          editor={(v, setV) => <TextEditor label="Directions" value={v} onValue={setV} multiline />}
        />
        <FieldRow
          label="Amount in the directions"
          field={fields.doseAsWritten}
          onChange={set("doseAsWritten")}
          format={formatDose}
          photoUrl={photoUrl}
          editor={(v, setV) => <DoseEditor value={v} onValue={setV} />}
        />
        <FieldRow
          label="24-hour maximum"
          field={fields.max24h}
          onChange={set("max24h")}
          format={text}
          photoUrl={photoUrl}
          editor={(v, setV) => <TextEditor label="24-hour maximum" value={v} onValue={setV} multiline />}
        />
      </section>

      {doc && (
        <section className="space-y-3 rounded-xl border bg-card p-4" aria-labelledby={`${docId}-doc`}>
          <h2 id={`${docId}-doc`} className="text-lg font-semibold">
            Document details
          </h2>
          <p className="text-sm text-muted-foreground">As printed on the label or list. Leave blank if it isn&apos;t there.</p>
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

      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground sm:flex-1" aria-live="polite">
            {ready
              ? "Everything has been checked. Values you couldn't tell stay unresolved in the checks."
              : `${remaining} ${remaining === 1 ? "value needs" : "values need"} Matches, Edit or Can't tell.`}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1 sm:flex-none"
              disabled={pending}
              onClick={() => submit(saveAction)}
            >
              Finish later
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
