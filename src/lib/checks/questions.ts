// Fixed-template questions for a pharmacist, one template per finding type. They ask; they never
// answer, suggest an amount, or convert units.
import { capitalize, joinList } from "./shared";

export type Side = { source: string; value: string };

/** Drops repeated source + value pairs, keeping order. */
export function uniqueSides(sides: Side[]): Side[] {
  const seen = new Set<string>();
  return sides.filter((s) => {
    const key = `${s.source}|${s.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** "The discharge list says 160 mg per 5 mL but the bottle says 100 mg per 5 mL." */
function saysSentence(sides: Side[]): string {
  const parts = sides.map((s) => `${s.source} says ${s.value}`);
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

export function unitsQuestion(problem: UnitsProblem, source: string, dose: string, strength: string): string {
  const s = capitalize(source);
  switch (problem) {
    case "volume_units":
      return `${s} says to give ${dose}, but the strength is listed as ${strength}. How should I measure this, and with what?`;
    case "mass_dose":
      return `${s} gives the dose as ${dose}, but the strength is listed as ${strength}. What amount of liquid is that, and how should I measure it?`;
    case "unclear_unit":
      return `${s} says ${dose}, but the strength is listed as ${strength}. What amount, in what unit, should I use?`;
  }
}

export function databaseQuestion(product: string, diffs: { catalog: string; photo: string }[]): string {
  const ask = "Which label matches the product I have?";
  if (diffs.length === 1) {
    return `The barcode on ${product} matched a label that says ${diffs[0].catalog}, but the box I have says ${diffs[0].photo}. ${ask}`;
  }
  const pairs = diffs.map((d) => `the label says ${d.catalog}, the box says ${d.photo}`).join("; ");
  return `The barcode on ${product} matched a label that differs from the box I have: ${pairs}. ${ask}`;
}
