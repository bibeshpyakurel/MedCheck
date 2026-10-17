"use client";

import { createContext, useContext, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { amountUnitSchema, type DoseAsWritten, type Strength } from "@/lib/domain/schema";
import { parseDoseInput, parseStrengthInput, parseTextInput } from "./validation";

// Inputs for typing a value exactly as printed. Each keeps its own text and reports the parsed
// value (or null while it isn't valid) — numbers are never adjusted. Problems are explained inline
// once the user tries to save; nothing invalid is ever turned into unknown.

const inputClass = "h-11 text-base";

/**
 * Set by the field row after a rejected Save. Errors wait for Save (not blur) so a message
 * appearing mid-tap can't push the Save button out from under the finger.
 */
export const ShowEditorErrors = createContext(false);

/** aria props for one input; only set while its error is shown. */
function errorProps(id: string, error: string | undefined | null, show: boolean) {
  return show && error ? { "aria-invalid": true, "aria-describedby": id } : {};
}

function ErrorText({ id, error, show }: { id: string; error: string | undefined | null; show: boolean }) {
  if (!show || !error) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {error}
    </p>
  );
}

export function TextEditor({
  label,
  value,
  onValue,
  multiline = false,
}: {
  label: string;
  value: string | null;
  onValue: (v: string | null) => void;
  multiline?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(value ?? "");
  const show = useContext(ShowEditorErrors);
  const { error } = parseTextInput(text);
  const update = (t: string) => {
    setText(t);
    onValue(parseTextInput(t).value);
  };
  const common = { id, value: text, autoFocus: true, ...errorProps(`${id}-error`, error, show) };
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}, exactly as printed</Label>
      {multiline ? (
        <Textarea {...common} onChange={(e) => update(e.target.value)} rows={3} className="text-base" />
      ) : (
        <Input {...common} onChange={(e) => update(e.target.value)} className={inputClass} />
      )}
      <ErrorText id={`${id}-error`} error={error} show={show} />
    </div>
  );
}

const PER_UNITS = ["mL", "caplet", "tablet", "capsule", "softgel", "tsp"];

export function StrengthEditor({ value, onValue }: { value: Strength | null; onValue: (v: Strength | null) => void }) {
  const id = useId();
  const [text, setText] = useState({
    amount: value ? String(value.amount) : "",
    unit: value?.unit ?? "mg",
    perAmount: value?.perAmount ? String(value.perAmount) : "",
    perUnit: value?.perUnit ?? "",
  });
  const show = useContext(ShowEditorErrors);
  const { errors } = parseStrengthInput(text);

  function update(key: keyof typeof text, v: string) {
    const next = { ...text, [key]: v };
    setText(next);
    onValue(parseStrengthInput(next).value);
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Strength, exactly as printed (e.g. 160 mg per 5 mL)</legend>
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <Input
          aria-label="Amount"
          inputMode="decimal"
          value={text.amount}
          placeholder="160"
          className={inputClass}
          autoFocus
          onChange={(e) => update("amount", e.target.value)}
          {...errorProps(`${id}-amount-error`, errors.amount, show)}
        />
        <select
          aria-label="Unit"
          value={text.unit}
          className="h-11 rounded-lg border border-input bg-background px-2 text-base dark:bg-input/30"
          onChange={(e) => update("unit", e.target.value)}
        >
          {amountUnitSchema.options.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      <ErrorText id={`${id}-amount-error`} error={errors.amount} show={show} />
      <div className="grid grid-cols-[auto_1fr_8rem] items-center gap-2">
        <span className="text-sm text-muted-foreground">per</span>
        <Input
          aria-label="Per amount (leave empty for 'each')"
          inputMode="decimal"
          value={text.perAmount}
          placeholder="5"
          className={inputClass}
          onChange={(e) => update("perAmount", e.target.value)}
          {...errorProps(`${id}-per-amount-error`, errors.perAmount, show)}
        />
        <Input
          aria-label="Per unit"
          list={`${id}-per-units`}
          value={text.perUnit}
          placeholder="mL"
          className={inputClass}
          onChange={(e) => update("perUnit", e.target.value)}
          {...errorProps(`${id}-per-unit-error`, errors.perUnit, show)}
        />
        <datalist id={`${id}-per-units`}>
          {PER_UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </div>
      <ErrorText id={`${id}-per-amount-error`} error={errors.perAmount} show={show} />
      <ErrorText id={`${id}-per-unit-error`} error={errors.perUnit} show={show} />
    </fieldset>
  );
}

const DOSE_UNITS = ["mL", "tsp", "tbsp", "caplets", "tablets", "capsules", "mg"];

export function DoseEditor({
  value,
  onValue,
}: {
  value: DoseAsWritten | null;
  onValue: (v: DoseAsWritten | null) => void;
}) {
  const id = useId();
  const [text, setText] = useState({ amount: value ? String(value.amount) : "", unit: value?.unit ?? "" });
  const show = useContext(ShowEditorErrors);
  const { errors } = parseDoseInput(text);

  function update(key: keyof typeof text, v: string) {
    const next = { ...text, [key]: v };
    setText(next);
    onValue(parseDoseInput(next).value);
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Amount the directions say, exactly as written (e.g. 2 tsp)</legend>
      <div className="grid grid-cols-[1fr_8rem] gap-2">
        <Input
          aria-label="Amount"
          inputMode="decimal"
          value={text.amount}
          className={inputClass}
          autoFocus
          onChange={(e) => update("amount", e.target.value)}
          {...errorProps(`${id}-amount-error`, errors.amount, show)}
        />
        <Input
          aria-label="Unit"
          list={`${id}-dose-units`}
          value={text.unit}
          placeholder="mL"
          className={inputClass}
          onChange={(e) => update("unit", e.target.value)}
          {...errorProps(`${id}-unit-error`, errors.unit, show)}
        />
        <datalist id={`${id}-dose-units`}>
          {DOSE_UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </div>
      <ErrorText id={`${id}-amount-error`} error={errors.amount} show={show} />
      <ErrorText id={`${id}-unit-error`} error={errors.unit} show={show} />
    </fieldset>
  );
}
