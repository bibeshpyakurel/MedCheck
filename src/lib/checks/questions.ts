// Fixed-template questions for a pharmacist, one template per finding type. They ask; they never
// answer, suggest an amount, or convert units. A value the user typed is said as "I entered …",
// never attributed to a label.
import { capitalize, joinList, type Provenance } from "./shared";

/** `from` defaults to "label": the source says the value. */
export type Side = { source: string; value: string; from?: Provenance };

/** Drops repeated source + value pairs, keeping order. */
export function uniqueSides(sides: Side[]): Side[] {
  const seen = new Set<string>();
  return sides.filter((s) => {
    const key = `${s.source}|${s.value}|${s.from ?? "label"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** "the package label says 100 mg per 5 mL" or "I entered 100 mg per 5 mL for the package". */
function sideClause(s: Side): string {
  return s.from === "entered" ? `I entered ${s.value} for ${s.source}` : `${s.source} says ${s.value}`;
}

/** "The discharge list says 160 mg per 5 mL but the package label says 100 mg per 5 mL." */
function saysSentence(sides: Side[]): string {
  const parts = sides.map(sideClause);
  const sentence = parts.length === 2 ? `${parts[0]} but ${parts[1]}` : joinList(parts);
  return capitalize(sentence);
}

export function strengthQuestion(sides: Side[]): string {
  return `${saysSentence(sides)}. Which strength should I be using, and how much?`;
}

export function doseQuestion(sides: Side[]): string {
  return `${saysSentence(sides)}. How much should I give, and how should I measure it?`;
}

export function overlapQuestion(products: string[], ingredient: string): string {
  const both = products.length === 2 ? "both" : "all";
  return `${joinList(products)} ${both} contain ${ingredient}. Can they be used together, and what should I watch for?`;
}

export function repeatQuestion(product: string, count: number): string {
  return `${product} is in my list ${count} times. Is this the same medicine, or are two of the same product being used?`;
}

export type UnitsProblem = "volume_units" | "mass_dose" | "unclear_unit";

/** `dose` and `strength` come from the same entry; `dose.source` names it ("the prescription label"). */
export function unitsQuestion(problem: UnitsProblem, dose: Side, strength: Side): string {
  const typedDose = dose.from === "entered" ? `I entered the dose for ${dose.source} as ${dose.value}` : null;
  const s =
    strength.from === "entered" ? `I entered the strength as ${strength.value}` : `the strength is listed as ${strength.value}`;
  switch (problem) {
    case "volume_units":
      return `${capitalize(typedDose ?? `${dose.source} says to give ${dose.value}`)}, but ${s}. How should I measure this, and with what?`;
    case "mass_dose":
      return `${capitalize(typedDose ?? `${dose.source} gives the dose as ${dose.value}`)}, but ${s}. What amount of liquid is that, and how should I measure it?`;
    case "unclear_unit":
      return `${capitalize(typedDose ?? `${dose.source} says ${dose.value}`)}, but ${s}. What amount, in what unit, should I use?`;
  }
}

export function databaseQuestion(product: string, diffs: { catalog: string; photo: string; photoFrom?: Provenance }[]): string {
  const ask = "Which label matches the product I have?";
  const box = (d: (typeof diffs)[number], single: boolean) =>
    d.photoFrom === "entered"
      ? `I entered ${d.photo} from the box${single ? " I have" : ""}`
      : `the box${single ? " I have" : ""} says ${d.photo}`;
  if (diffs.length === 1) {
    return `The barcode on ${product} matched a label that says ${diffs[0].catalog}, but ${box(diffs[0], true)}. ${ask}`;
  }
  const pairs = diffs.map((d) => `the label says ${d.catalog}, ${box(d, false)}`).join("; ");
  return `The barcode on ${product} matched a label that differs from the box I have: ${pairs}. ${ask}`;
}
