// Ingredient chip colors. Pure; safe on client and server.
// Every spelling of one ingredient gets one color on every screen, because the slot comes from
// normalizeIngredient(). A shared ingredient is always the overlap tone (amber), whatever its slot;
// amber is reserved for that and isn't in the palette (globals.css --ing-1…--ing-8).
import { normalizeIngredient } from "@/lib/domain/ingredients";

export const INGREDIENT_SLOTS = 8;

export type IngredientTone = "overlap" | `ing-${number}`;

/** 1…8, stable for a normalized ingredient name. */
export function ingredientSlot(name: string): number {
  let h = 0;
  for (const c of normalizeIngredient(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (h % INGREDIENT_SLOTS) + 1;
}

/** `overlapping` holds normalized names (see overlappingIngredients()). */
export function ingredientTone(name: string, overlapping: ReadonlySet<string>): IngredientTone {
  return overlapping.has(normalizeIngredient(name)) ? "overlap" : `ing-${ingredientSlot(name)}`;
}
