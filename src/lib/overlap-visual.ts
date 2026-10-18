// What the overlap diagram and the amber ingredient chips show, read from the checks' findings.
// Pure. Nothing is computed: each product's strength is the same formatStrength() text shown on its
// card, side by side, never added up. The finding's evidence points at the ingredient it compared
// (`ingredients[k].name`), so the shared ingredient is the one the checks matched, not a second guess.
import { displayIngredientName } from "@/lib/checks/shared";
import { formatStrength } from "@/lib/domain/fields";
import { normalizeIngredient } from "@/lib/domain/ingredients";
import type { Finding, MedicationEntry } from "@/lib/domain/schema";

export type OverlapProduct = { entryId: string; name: string; strength: string | null };

export type OverlapVisual = {
  /** As the label prints it, without a strength: "Acetaminophen". */
  ingredient: string;
  normalized: string;
  products: OverlapProduct[];
};

const INGREDIENT_FIELD = /^ingredients\[(\d+)\]\.name$/;

function sharedIngredient(evidence: Finding["evidence"][number], entries: ReadonlyMap<string, MedicationEntry>) {
  const index = INGREDIENT_FIELD.exec(evidence.field)?.[1];
  const entry = entries.get(evidence.entryId);
  const ingredient = index === undefined ? undefined : entry?.fields.ingredients[Number(index)];
  return ingredient?.name.value ? { entry: entry!, ingredient } : null;
}

/** The diagram for an ingredient-overlap finding; null for any other finding. */
export function overlapVisual(finding: Finding, entries: ReadonlyMap<string, MedicationEntry>): OverlapVisual | null {
  if (finding.check !== "ingredient_overlap") return null;
  const hits = finding.evidence.flatMap((e) => {
    const hit = sharedIngredient(e, entries);
    return hit ? [{ evidence: e, ...hit }] : [];
  });
  if (hits.length < 2) return null;
  const name = hits[0].ingredient.name.value!;
  return {
    ingredient: displayIngredientName(name),
    normalized: normalizeIngredient(name),
    products: hits.map(({ evidence, ingredient }) => ({
      entryId: evidence.entryId,
      name: evidence.entryLabel,
      strength: ingredient.strength.value ? formatStrength(ingredient.strength.value) : null,
    })),
  };
}

/** Normalized names of every ingredient the findings say is shared. */
export function overlappingIngredients(findings: Finding[], entries: ReadonlyMap<string, MedicationEntry>): Set<string> {
  return new Set(findings.flatMap((f) => overlapVisual(f, entries)?.normalized ?? []));
}
