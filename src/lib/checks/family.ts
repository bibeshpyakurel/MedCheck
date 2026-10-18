// Check — ingredient family: two distinct products hold different active ingredients of one reviewed
// family (ibuprofen and naproxen are both NSAIDs). Reported only when a catalog label of one of
// those products names the family in its own warning; that sentence is the evidence. The same
// ingredient in two products is the overlap check's, not a family. States the facts only.
import { familyQuote, matchFamilies } from "@/lib/compare";
import type { CheckInput, CheckRun, Finding, Formulation, MedicationEntry } from "@/lib/domain/schema";
import { groupByProduct, representative } from "./identity";
import { ingredientProvenance, labelText } from "./overlap";
import { familyQuestion } from "./questions";
import {
  buildRun,
  capitalize,
  evidenceItem,
  ingredientProblem,
  joinList,
  labelOf,
  makeFinding,
  plural,
  PROVENANCE_NOTE,
  type UsableIngredient,
  usableIngredients,
} from "./shared";

type Hit = { product: MedicationEntry; normalized: string; ing: UsableIngredient };

export function checkIngredientFamily({ entries, formulations }: CheckInput): CheckRun {
  const reasons = entries.length >= 2 ? entries.flatMap((e) => ingredientProblem(e) ?? []) : [];
  const products = groupByProduct(entries).map(representative);
  // Keep input order for display.
  const ordered = entries.filter((e) => products.includes(e));

  // Each confirmed ingredient once per product.
  const items: Hit[] = ordered.flatMap((entry) => {
    const seen = new Set<string>();
    return usableIngredients(entry).flatMap((ing) => (seen.has(ing.normalized) ? [] : (seen.add(ing.normalized), [{ product: entry, normalized: ing.normalized, ing }])));
  });
  // Only an entry from the catalog has a label to quote.
  const labelsOf = (hits: Hit[]) =>
    ordered.flatMap((e): Formulation[] => (hits.some((h) => h.product === e) && e.formulationId && formulations[e.formulationId] ? [formulations[e.formulationId]] : []));

  const findings: Finding[] = [];
  for (const { family, members: hits, labelQuote: quote } of matchFamilies(items, (family, hits) => familyQuote(labelsOf(hits), family.labelTerm))) {
    const hitEntries = ordered.filter((e) => hits.some((h) => h.product === e));
    const names = [...new Set(hitEntries.map(labelOf))];
    const ingredientNames = [...new Set(hits.map((h) => h.ing.normalized))];
    const lines = [...new Set(hits.map((h) => `${labelOf(h.product)} lists ${labelText(h.ing)}${PROVENANCE_NOTE[ingredientProvenance(h.product, h.ing)]}`))];
    findings.push(
      makeFinding({
        check: "ingredient_family",
        discriminator: family.id,
        entryIds: hits.map((h) => h.product.id),
        title: `${joinList(names)} ${names.length === 2 ? "both" : "all"} contain ${family.name}`,
        detail: `${lines.join(". ")}. ${capitalize(joinList(ingredientNames))} are different active ingredients, ${ingredientNames.length === 2 ? "both" : "all"} ${family.name}.`,
        evidence: hits.map((h) =>
          evidenceItem(h.product, `ingredients[${h.ing.index}].name`, labelText(h.ing), h.product.fields.ingredients[h.ing.index].name.evidence),
        ),
        labelWarningQuote: quote,
        pharmacistQuestion: familyQuestion(
          hitEntries.map((e) => ({ product: labelOf(e), ingredients: hits.filter((h) => h.product === e).map((h) => h.ing.normalized) })),
          family.name,
        ),
      }),
    );
  }

  return buildRun("ingredient_family", {
    findings,
    reasons,
    compared: entries.length >= 2,
    found: (n) => `Found ${plural(n, "shared family of medicine", "shared families of medicine")}`,
    noFinding: "No two medicines from the same family found in confirmed fields",
    notApplicable: "No two different medicines to compare",
  });
}
