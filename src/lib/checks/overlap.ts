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
  countWord,
  displayIngredientName,
  evidenceItem,
  ingredientProblem,
  joinList,
  labelOf,
  makeFinding,
  plural,
  type Provenance,
  PROVENANCE_NOTE,
  provenanceOf,
  type UsableIngredient,
  usableIngredients,
} from "./shared";

/** "Acetaminophen 325 mg per caplet", or just the name when the strength isn't usable. */
function labelText(ing: UsableIngredient): string {
  const name = displayIngredientName(ing.name);
  return ing.strength ? `${name} ${formatStrength(ing.strength)}` : name;
}

/** "entered" when the user typed the name or the shown strength. */
function ingredientProvenance(entry: MedicationEntry, ing: UsableIngredient): Provenance {
  const name = provenanceOf(entry, entry.fields.ingredients[ing.index].name);
  return name === "label" && ing.strength ? provenanceOf(entry, ing.strengthField) : name;
}

/**
 * The label's own warning about this ingredient, across the products: preferably the direct
 * "do not use with other drugs containing …" line (it states the overlap itself), else the first
 * warning that mentions the ingredient.
 */
export function warningQuote(
  entries: MedicationEntry[],
  formulations: Record<string, Formulation>,
  ingredient: string,
): string | null {
  const mentions = entries.flatMap((e) => {
    const f = e.formulationId ? formulations[e.formulationId] : undefined;
    return f?.warningsQuotes.filter((w) => w.toLowerCase().includes(ingredient.toLowerCase())) ?? [];
  });
  return mentions.find((w) => /do not use[^.]*other drugs? containing/i.test(w)) ?? mentions[0] ?? null;
}

/** "NyQuil and Tylenol both contain Acetaminophen"; a count when two products share a name. */
function overlapTitle(names: string[], count: number, ingredient: string): string {
  if (names.length < 2) return `${capitalize(countWord(count))} medicines contain ${ingredient}`;
  return `${joinList(names)} ${names.length === 2 ? "both" : "all"} contain ${ingredient}`;
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
    const lines = [...new Set(hits.map((h) => `${labelOf(h.entry)} lists ${labelText(h.ing)}${PROVENANCE_NOTE[ingredientProvenance(h.entry, h.ing)]}`))];
    findings.push(
      makeFinding({
        check: "ingredient_overlap",
        discriminator: ingredient,
        entryIds: hits.map((h) => h.entry.id),
        title: overlapTitle(names, hits.length, shown),
        detail: `${lines.join(". ")}.`,
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
    notApplicable: "No two different medicines to compare",
  });
}
