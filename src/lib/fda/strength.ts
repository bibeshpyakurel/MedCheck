// Strengths from the NDC Directory ("200 mg/1", "100 mg/5mL") and the label's own "(in each …)" wording.
// Pure. Units outside the contract's `amountUnitSchema` are rejected, never guessed.
import type { AmountUnit } from "@/lib/domain/schema";

export type NdcStrength = {
  amount: number;
  unit: AmountUnit;
  /** "count": per N of the product's unit (tablet, caplet …). "measure": per N mL / g / mg. */
  per: { kind: "count"; amount: number } | { kind: "measure"; amount: number; unit: string };
};

export type StrengthResult = { ok: true; value: NdcStrength } | { ok: false; reason: "unknown_unit" | "unreadable" };

/** NDC Directory unit spellings (UCUM-ish) → contract units. */
const AMOUNT_UNITS: Record<string, AmountUnit> = {
  mg: "mg",
  g: "g",
  mcg: "mcg",
  ug: "mcg",
  ml: "mL",
  l: "L",
  "[usp'u]": "unit",
  "[iu]": "unit",
};

/** Denominator units we keep as a measure (anything else is unknown). */
const PER_UNITS: Record<string, string> = { ml: "mL", l: "L", g: "g", mg: "mg" };

const STRENGTH = /^\s*(\d+(?:\.\d+)?|\.\d+)\s*(\S+?)\s*\/\s*(\d+(?:\.\d+)?|\.\d+)?\s*([^\s\d]*)\s*$/;

export function parseNdcStrength(raw: string): StrengthResult {
  const m = raw.match(STRENGTH);
  if (!m) return { ok: false, reason: "unreadable" };
  const [, amountText, unitText, perAmountText, perUnitText] = m;
  const amount = Number(amountText);
  const unit = AMOUNT_UNITS[unitText.toLowerCase()];
  if (!unit) return { ok: false, reason: "unknown_unit" };
  const perAmount = perAmountText === undefined ? 1 : Number(perAmountText);
  if (!(amount > 0) || !(perAmount > 0)) return { ok: false, reason: "unreadable" };
  if (perUnitText === "") return { ok: true, value: { amount, unit, per: { kind: "count", amount: perAmount } } };
  const perUnit = PER_UNITS[perUnitText.toLowerCase()];
  if (!perUnit) return { ok: false, reason: "unknown_unit" };
  return { ok: true, value: { amount, unit, per: { kind: "measure", amount: perAmount, unit: perUnit } } };
}

/** What the label says each strength is "in": a volume ("in each 5 mL") or a unit ("in each caplet"). */
export type LabelPer = { kind: "volume"; amount: number } | { kind: "count"; noun: string };

const IN_EACH = /\(\s*(?:in\s+)?(?:each|per)\s+([^()]+?)\s*\)/gi;

/** Every distinct "(in each …)" / "(per …)" in the Active ingredient text, in order. */
export function labelPers(activeIngredientText: string): LabelPer[] {
  const found: LabelPer[] = [];
  for (const m of activeIngredientText.replace(/\s+/g, " ").matchAll(IN_EACH)) {
    const inner = m[1].split(/[=,;]/)[0].trim().toLowerCase();
    const volume = inner.match(/^(\d+(?:\.\d+)?)\s*ml\b/);
    let per: LabelPer | null = null;
    if (volume) per = { kind: "volume", amount: Number(volume[1]) };
    else if (/^[a-z][a-z -]*$/.test(inner)) per = { kind: "count", noun: inner.replace(/s$/, "").trim() };
    if (!per) continue;
    const key = JSON.stringify(per);
    if (!found.some((f) => JSON.stringify(f) === key)) found.push(per);
  }
  return found;
}
