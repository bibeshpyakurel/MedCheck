// Check 1 — ingredient overlap: two distinct products share a normalized active ingredient.
// Repeats of the same product are counted once (the repeated_record check reports them).
// States the facts only; never claims the dose doubled.
import { formatStrength } from "@/lib/domain/fields";
import type { CheckInput, CheckRun, Finding, Formulation, MedicationEntry } from "@/lib/domain/schema";
import { groupByProduct, representative } from "./identity";
import { overlapQuestion } from "./questions";
import {
  buildRun,
  capitalize,
  displayIngredientName,
  evidenceItem,
  ingredientProblem,
  joinList,
  labelOf,
  makeFinding,
  plural,
  type UsableIngredient,
  usableIngredients,
} from "./shared";

/** "Acetaminophen 325 mg per caplet", or just the name when the strength isn't usable. */
function labelText(ing: UsableIngredient): string {
  const name = displayIngredientName(ing.name);
  return ing.strength ? `${name} ${formatStrength(ing.strength)}` : name;
}

/** The first catalog warning, across the products, that mentions the ingredient. */
export function warningQuote(
  entries: MedicationEntry[],
  formulations: Record<string, Formulation>,
  ingredient: string,
): string | null {
  for (const e of entries) {
    const f = e.formulationId ? formulations[e.formulationId] : undefined;
    const quote = f?.warningsQuotes.find((w) => w.toLowerCase().includes(ingredient.toLowerCase()));
    if (quote) return quote;
  }
  return null;
}

export function checkIngredientOverlap({ entries, formulations }: CheckInput): CheckRun {
  const reasons = entries.length >= 2 ? entries.flatMap((e) => ingredientProblem(e) ?? []) : [];
  const products = groupByProduct(entries).map(representative);
  // Keep input order for display.
  const ordered = entries.filter((e) => products.includes(e));

  const byIngredient = new Map<string, { entry: MedicationEntry; ing: UsableIngredient }[]>();
  for (const entry of ordered) {
    const seen = new Set<string>();
    for (const ing of usableIngredients(entry)) {
      if (seen.has(ing.normalized)) continue;
      seen.add(ing.normalized);
      byIngredient.set(ing.normalized, [...(byIngredient.get(ing.normalized) ?? []), { entry, ing }]);
    }
  }

  const findings: Finding[] = [];
  for (const [ingredient, hits] of byIngredient) {
    if (hits.length < 2) continue;
    const names = [...new Set(hits.map((h) => labelOf(h.entry)))];
    const shown = displayIngredientName(hits[0].ing.name);
    const lines = [...new Set(hits.map((h) => `${labelOf(h.entry)} lists ${labelText(h.ing)}`))];
    findings.push(
      makeFinding({
        check: "ingredient_overlap",
        discriminator: ingredient,
        entryIds: hits.map((h) => h.entry.id),
        title: `${capitalize(shown)} is in ${plural(hits.length, "medicine", "medicines")}`,
        detail: `${joinList(names)} ${hits.length === 2 ? "both" : "all"} list ${shown} as an active ingredient. ${lines.join(". ")}.`,
        evidence: hits.map((h) =>
          evidenceItem(h.entry, `ingredients[${h.ing.index}].name`, labelText(h.ing), h.entry.fields.ingredients[h.ing.index].name.evidence),
        ),
        labelWarningQuote: warningQuote(
          hits.map((h) => h.entry),
          formulations,
          ingredient,
        ),
        pharmacistQuestion: overlapQuestion(names, ingredient),
      }),
    );
  }

  return buildRun("ingredient_overlap", {
    findings,
    reasons,
    compared: entries.length >= 2,
    found: (n) => `Found ${plural(n, "shared active ingredient", "shared active ingredients")}`,
    noFinding: "No shared active ingredients found in confirmed fields",
    notApplicable: "Fewer than two different medicines on file",
  });
}
