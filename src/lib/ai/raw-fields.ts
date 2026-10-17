// Pure mapping from the model's raw answer to EntryFields. Shared by photo extraction and
// description. Values are only trimmed and unit spellings normalized ("ml" → "mL"); no number
// is ever changed, inferred or calculated. Every non-null value is `pending` until the user acts.
import { suggestedField } from "@/lib/domain/fields";
import type {
  AmountUnit,
  DoseAsWritten,
  EntryFields,
  Evidence,
  IngredientFields,
  Strength,
} from "@/lib/domain/schema";

export type RawText = { value: string | null };
export type RawStrength = { amount: number | null; unit: string | null; perAmount: number | null; perUnit: string | null };
export type RawDose = { amount: number | null; unit: string | null };

/** The model's answer for one medication; `L` is how a value is located (a box, or a quote). */
export type RawMedication<L> = {
  productName: RawText & L;
  dosageForm: RawText & L;
  ingredients: { name: RawText & L; strength: RawStrength & L }[];
  instructions: RawText & L;
  doseAsWritten: RawDose & L;
  max24h: RawText & L;
};

const UNIT_SPELLINGS: Record<string, AmountUnit> = {
  mg: "mg",
  milligram: "mg",
  milligrams: "mg",
  mcg: "mcg",
  µg: "mcg",
  ug: "mcg",
  microgram: "mcg",
  micrograms: "mcg",
  g: "g",
  gram: "g",
  grams: "g",
  ml: "mL",
  milliliter: "mL",
  milliliters: "mL",
  millilitre: "mL",
  millilitres: "mL",
  l: "L",
  liter: "L",
  liters: "L",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  unit: "unit",
  units: "unit",
};

/** Maps a printed unit spelling to the contract's unit, or null when it isn't one we know. */
export function normalizeUnit(raw: string | null | undefined): AmountUnit | null {
  if (!raw) return null;
  return UNIT_SPELLINGS[raw.trim().replace(/\.$/, "").toLowerCase()] ?? null;
}

export function cleanText(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  return t ? t : null;
}

function positive(n: number | null | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

export function toStrength(raw: RawStrength): Strength | null {
  const amount = positive(raw.amount);
  const unit = normalizeUnit(raw.unit);
  if (amount === null || unit === null) return null;
  const perUnitText = cleanText(raw.perUnit);
  const perUnit = perUnitText ? (normalizeUnit(perUnitText) ?? perUnitText) : null;
  return { amount, unit, perAmount: perUnit ? positive(raw.perAmount) : null, perUnit };
}

export function toDose(raw: RawDose): DoseAsWritten | null {
  const amount = positive(raw.amount);
  const unit = cleanText(raw.unit);
  return amount === null || unit === null ? null : { amount, unit };
}

export function buildEntryFields<L>(raw: RawMedication<L>, evidenceFor: (located: L) => Evidence): EntryFields {
  const ingredients: IngredientFields[] = raw.ingredients
    .map((i) => ({
      name: suggestedField(cleanText(i.name.value), evidenceFor(i.name)),
      strength: suggestedField(toStrength(i.strength), evidenceFor(i.strength)),
    }))
    .filter((i) => i.name.value !== null || i.strength.value !== null);
  return {
    productName: suggestedField(cleanText(raw.productName.value), evidenceFor(raw.productName)),
    dosageForm: suggestedField(cleanText(raw.dosageForm.value), evidenceFor(raw.dosageForm)),
    ingredients,
    instructions: suggestedField(cleanText(raw.instructions.value), evidenceFor(raw.instructions)),
    doseAsWritten: suggestedField(toDose(raw.doseAsWritten), evidenceFor(raw.doseAsWritten)),
    max24h: suggestedField(cleanText(raw.max24h.value), evidenceFor(raw.max24h)),
  };
}

/** Every field `unknown` with the same evidence, plus one blank ingredient row for the user to fill in. */
export function unknownEntryFields(evidence: Evidence): EntryFields {
  const unknown = <T>() => suggestedField<T>(null, evidence);
  return {
    productName: unknown(),
    dosageForm: unknown(),
    ingredients: [{ name: unknown(), strength: unknown() }],
    instructions: unknown(),
    doseAsWritten: unknown(),
    max24h: unknown(),
  };
}
