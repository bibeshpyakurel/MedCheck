// Product identity: when two entries are the same product (a repeat), not two products.
import { isUsable } from "@/lib/domain/fields";
import { normalizeIngredient } from "@/lib/domain/ingredients";
import type { MedicationEntry } from "@/lib/domain/schema";
import { formFamily, strengthKey } from "./shared";

const normalizeText = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Normalized name + strength + form from confirmed fields; null when any of them isn't usable. */
export function productDescriptor(entry: MedicationEntry): string | null {
  const { productName, dosageForm, ingredients } = entry.fields;
  if (!isUsable(productName) || !isUsable(dosageForm) || ingredients.length === 0) return null;
  const strengths: string[] = [];
  for (const ing of ingredients) {
    if (!isUsable(ing.name) || !isUsable(ing.strength)) return null;
    strengths.push(`${normalizeIngredient(ing.name.value)}=${strengthKey(ing.strength.value)}`);
  }
  const family = formFamily(entry);
  const form = family === "liquid" ? "liquid" : normalizeText(dosageForm.value).replace(/s$/, "");
  return `${normalizeText(productName.value)}|${strengths.sort().join("+")}|${form}`;
}

/** The catalog formulation id, else normalized name + strength + form; null when it can't be told. */
export function productIdentity(entry: MedicationEntry): string | null {
  if (entry.formulationId) return `formulation:${entry.formulationId}`;
  const d = productDescriptor(entry);
  return d === null ? null : `product:${d}`;
}

/** Same product: same catalog formulation, or same name + strength + form. */
export function sameProduct(a: MedicationEntry, b: MedicationEntry): boolean {
  if (a.formulationId && a.formulationId === b.formulationId) return true;
  const da = productDescriptor(a);
  return da !== null && da === productDescriptor(b);
}

/** Groups entries that are the same product, in first-seen order. Unidentifiable entries stay alone. */
export function groupByProduct(entries: MedicationEntry[]): MedicationEntry[][] {
  const groups: MedicationEntry[][] = [];
  for (const e of entries) {
    const matches = groups.filter((g) => g.some((other) => sameProduct(e, other)));
    if (matches.length === 0) {
      groups.push([e]);
      continue;
    }
    // Merge every group this entry connects (a catalog entry may match two photo entries).
    const [first, ...rest] = matches;
    first.push(e, ...rest.flat());
    for (const g of rest) groups.splice(groups.indexOf(g), 1);
  }
  return groups.map((g) => sortByInput(g, entries));
}

/** One stable representative per product: the smallest entry id. */
export function representative(group: MedicationEntry[]): MedicationEntry {
  return [...group].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
}

function sortByInput(group: MedicationEntry[], order: MedicationEntry[]): MedicationEntry[] {
  return [...group].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}
