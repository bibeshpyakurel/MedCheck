// Turns what the user typed in a review editor into a value, or plain-language errors.
// Shared by the editors (inline errors) and the review Server Actions (same rules on the server).
// Numbers are read exactly as typed — never adjusted. "Can't tell" only ever comes from its button.
import {
  amountUnitSchema,
  entryFieldsSchema,
  type DoseAsWritten,
  type EntryFields,
  type Field,
  type Strength,
} from "@/lib/domain/schema";

const MUST_BE_POSITIVE = "Enter a number greater than 0";

/** Plain digits with an optional decimal point ("160", "0.5", ".5"); no signs, exponents or units. */
function positiveNumber(text: string): number | null {
  const t = text.trim();
  if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return n > 0 ? n : null;
}

export type StrengthInput = { amount: string; unit: string; perAmount: string; perUnit: string };
export type StrengthErrors = Partial<Record<"amount" | "unit" | "perAmount" | "perUnit", string>>;

export function parseStrengthInput(input: StrengthInput): { value: Strength | null; errors: StrengthErrors } {
  const errors: StrengthErrors = {};
  const amount = positiveNumber(input.amount);
  if (amount === null) errors.amount = `${MUST_BE_POSITIVE}, e.g. 160.`;
  const unit = amountUnitSchema.safeParse(input.unit);
  if (!unit.success) errors.unit = "Choose a unit.";
  const perUnit = input.perUnit.trim();
  // An empty "per" amount means "each" (e.g. 500 mg per caplet).
  const perAmount = input.perAmount.trim() ? positiveNumber(input.perAmount) : null;
  if (input.perAmount.trim() && perAmount === null) errors.perAmount = `${MUST_BE_POSITIVE}, e.g. 5, or leave it empty.`;
  if (input.perAmount.trim() && !perUnit) errors.perUnit = "Enter what it's per, e.g. mL.";

  if (amount === null || !unit.success || Object.keys(errors).length) return { value: null, errors };
  return { value: { amount, unit: unit.data, perAmount: perUnit ? perAmount : null, perUnit: perUnit || null }, errors };
}

export type DoseInput = { amount: string; unit: string };
export type DoseErrors = Partial<Record<"amount" | "unit", string>>;

export function parseDoseInput(input: DoseInput): { value: DoseAsWritten | null; errors: DoseErrors } {
  const errors: DoseErrors = {};
  const amount = positiveNumber(input.amount);
  if (amount === null) errors.amount = `${MUST_BE_POSITIVE}, e.g. 5.`;
  const unit = input.unit.trim();
  if (!unit) errors.unit = "Enter the unit, e.g. mL.";
  return { value: amount !== null && unit ? { amount, unit } : null, errors };
}

export function parseTextInput(text: string): { value: string | null; error: string | null } {
  const t = text.trim();
  return t
    ? { value: t, error: null }
    : { value: null, error: "Type it as printed, or tap Cancel and choose Can't tell." };
}

function allFields(f: EntryFields): Field<unknown>[] {
  return [
    f.productName,
    f.dosageForm,
    ...f.ingredients.flatMap((i) => [i.name, i.strength]),
    f.instructions,
    f.doseAsWritten,
    f.max24h,
  ];
}

/** Server-side check of submitted review fields; returns a message the user can act on. */
export function validateReviewFields(input: unknown): { fields: EntryFields } | { error: string } {
  const parsed = entryFieldsSchema.safeParse(input);
  if (!parsed.success) {
    const paths = parsed.error.issues.map((i) => i.path.map(String));
    if (paths.some((p) => p.includes("strength") && (p.includes("amount") || p.includes("perAmount"))))
      return { error: "Strength amounts must be numbers greater than 0. Edit the strength, or tap Can't tell." };
    if (paths.some((p) => p.includes("doseAsWritten") && p.includes("amount")))
      return { error: "The amount the directions say must be a number greater than 0. Edit it, or tap Can't tell." };
    return { error: "Some values aren't valid. Edit them, or tap Can't tell." };
  }
  // A value only counts once the user confirmed or edited it — never store that state without a value.
  if (allFields(parsed.data).some((f) => (f.state === "confirmed" || f.state === "edited") && f.value === null))
    return { error: "A value is missing. Edit it, or tap Can't tell." };
  return { fields: parsed.data };
}
