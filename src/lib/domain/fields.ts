// Helpers for building and reading EntryFields. Pure; safe on client and server.
import type {
  CatalogIngredient,
  DoseAsWritten,
  EntryFields,
  Evidence,
  Field,
  Formulation,
  Strength,
} from "./schema";

export function emptyField<T>(): Field<T> {
  return { aiValue: null, value: null, state: "unknown", evidence: { kind: "none" } };
}

/** A suggestion (from AI or the catalog) waiting for the user. */
export function suggestedField<T>(value: T | null, evidence: Evidence): Field<T> {
  if (value === null) return { aiValue: null, value: null, state: "unknown", evidence };
  return { aiValue: value, value, state: "pending", evidence };
}

export function emptyEntryFields(): EntryFields {
  return {
    productName: emptyField(),
    dosageForm: emptyField(),
    ingredients: [],
    instructions: emptyField(),
    doseAsWritten: emptyField(),
    max24h: emptyField(),
  };
}

/** Fields pre-filled from a catalog label (barcode or picker). Still `pending` until the user confirms. */
export function fieldsFromFormulation(f: Formulation): EntryFields {
  const db = (text?: string): Evidence => ({ kind: "database", formulationId: f.id, text });
  return {
    productName: suggestedField(f.brandName, db(f.brandName)),
    dosageForm: suggestedField(f.dosageForm, db()),
    ingredients: f.activeIngredients.map((i: CatalogIngredient) => ({
      name: suggestedField(i.name, db(i.name)),
      strength: suggestedField(i.strength, db(formatStrength(i.strength))),
    })),
    instructions: suggestedField(f.directionsText, db(f.directionsText ?? undefined)),
    doseAsWritten: emptyField(),
    max24h: suggestedField(f.max24hText, db(f.max24hText ?? undefined)),
  };
}

/** A field the checks may rely on: the user confirmed or edited it, and it has a value. */
export function isUsable<T>(field: Field<T>): field is Field<T> & { value: T } {
  return (field.state === "confirmed" || field.state === "edited") && field.value !== null;
}

/** True when every field (including each ingredient) has been acted on — nothing still `pending`. */
export function isFullyReviewed(fields: EntryFields): boolean {
  const all: Field<unknown>[] = [
    fields.productName,
    fields.dosageForm,
    fields.instructions,
    fields.doseAsWritten,
    fields.max24h,
    ...fields.ingredients.flatMap((i) => [i.name, i.strength] as Field<unknown>[]),
  ];
  return all.every((f) => f.state !== "pending");
}

/** "100 mg per 5 mL", "325 mg per caplet", "500 mg". */
export function formatStrength(s: Strength): string {
  const base = `${trimNumber(s.amount)} ${s.unit}`;
  if (!s.perUnit) return base;
  if (s.perAmount === null || s.perAmount === 1) return `${base} per ${s.perUnit}`;
  return `${base} per ${trimNumber(s.perAmount)} ${s.perUnit}`;
}

export function formatDose(d: DoseAsWritten): string {
  return `${trimNumber(d.amount)} ${d.unit}`;
}

/** Display name for an entry: confirmed product name, else the suggestion, else a placeholder. */
export function entryLabel(fields: EntryFields): string {
  return fields.productName.value ?? fields.productName.aiValue ?? "Unnamed medicine";
}

function trimNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
}
