"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { amountUnitSchema, type DoseAsWritten, type Strength } from "@/lib/domain/schema";

// Inputs for typing a value exactly as printed. Each keeps its own text and reports the parsed
// value (or null when incomplete) — numbers are never adjusted.

const inputClass = "h-11 text-base";

function toNumber(text: string): number | null {
  const n = Number(text.trim());
  return text.trim() && Number.isFinite(n) && n > 0 ? n : null;
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
  const update = (t: string) => {
    setText(t);
    onValue(t.trim() ? t.trim() : null);
  };
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}, exactly as printed</Label>
      {multiline ? (
        <Textarea id={id} value={text} onChange={(e) => update(e.target.value)} rows={3} className="text-base" autoFocus />
      ) : (
        <Input id={id} value={text} onChange={(e) => update(e.target.value)} className={inputClass} autoFocus />
      )}
    </div>
  );
}

const PER_UNITS = ["mL", "caplet", "tablet", "capsule", "softgel", "tsp"];

export function StrengthEditor({ value, onValue }: { value: Strength | null; onValue: (v: Strength | null) => void }) {
  const id = useId();
  const [amount, setAmount] = useState(value ? String(value.amount) : "");
  const [unit, setUnit] = useState<string>(value?.unit ?? "mg");
  const [perAmount, setPerAmount] = useState(value?.perAmount ? String(value.perAmount) : "");
  const [perUnit, setPerUnit] = useState(value?.perUnit ?? "");

  function emit(next: { amount?: string; unit?: string; perAmount?: string; perUnit?: string }) {
    const a = next.amount ?? amount;
    const u = next.unit ?? unit;
    const pa = next.perAmount ?? perAmount;
    const pu = (next.perUnit ?? perUnit).trim();
    const parsedAmount = toNumber(a);
    const parsedUnit = amountUnitSchema.safeParse(u);
    onValue(
      parsedAmount !== null && parsedUnit.success
        ? { amount: parsedAmount, unit: parsedUnit.data, perAmount: pu ? toNumber(pa) : null, perUnit: pu || null }
        : null,
    );
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Strength, exactly as printed (e.g. 160 mg per 5 mL)</legend>
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <Input
          aria-label="Amount"
          inputMode="decimal"
          value={amount}
          placeholder="160"
          className={inputClass}
          autoFocus
          onChange={(e) => {
            setAmount(e.target.value);
            emit({ amount: e.target.value });
          }}
        />
        <select
          aria-label="Unit"
          value={unit}
          className="h-11 rounded-lg border border-input bg-background px-2 text-base dark:bg-input/30"
          onChange={(e) => {
            setUnit(e.target.value);
            emit({ unit: e.target.value });
          }}
        >
          {amountUnitSchema.options.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-[auto_1fr_8rem] items-center gap-2">
        <span className="text-sm text-muted-foreground">per</span>
        <Input
          aria-label="Per amount (leave empty for 'each')"
          inputMode="decimal"
          value={perAmount}
          placeholder="5"
          className={inputClass}
          onChange={(e) => {
            setPerAmount(e.target.value);
            emit({ perAmount: e.target.value });
          }}
        />
        <Input
          aria-label="Per unit"
          list={`${id}-per-units`}
          value={perUnit}
          placeholder="mL"
          className={inputClass}
          onChange={(e) => {
            setPerUnit(e.target.value);
            emit({ perUnit: e.target.value });
          }}
        />
        <datalist id={`${id}-per-units`}>
          {PER_UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </div>
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
  const [amount, setAmount] = useState(value ? String(value.amount) : "");
  const [unit, setUnit] = useState(value?.unit ?? "");
  const emit = (a: string, u: string) => {
    const n = toNumber(a);
    onValue(n !== null && u.trim() ? { amount: n, unit: u.trim() } : null);
  };
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Amount the directions say, exactly as written (e.g. 2 tsp)</legend>
      <div className="grid grid-cols-[1fr_8rem] gap-2">
        <Input
          aria-label="Amount"
          inputMode="decimal"
          value={amount}
          className={inputClass}
          autoFocus
          onChange={(e) => {
            setAmount(e.target.value);
            emit(e.target.value, unit);
          }}
        />
        <Input
          aria-label="Unit"
          list={`${id}-dose-units`}
          value={unit}
          placeholder="mL"
          className={inputClass}
          onChange={(e) => {
            setUnit(e.target.value);
            emit(amount, e.target.value);
          }}
        />
        <datalist id={`${id}-dose-units`}>
          {DOSE_UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </div>
    </fieldset>
  );
}
