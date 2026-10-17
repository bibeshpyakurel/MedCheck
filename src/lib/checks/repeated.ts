// Check 2 — repeated record: the same product identity entered more than once.
import { isUsable } from "@/lib/domain/fields";
import type { CheckInput, CheckRun, Finding, MedicationEntry } from "@/lib/domain/schema";
import { groupByProduct, productIdentity } from "./identity";
import { repeatQuestion } from "./questions";
import { buildRun, evidenceItem, labelOf, makeFinding, plural, sourceLabel, unusableReason } from "./shared";

/** Why an entry without a catalog id can't be identified: the first unusable field. */
function identityProblem(entry: MedicationEntry): string | null {
  if (productIdentity(entry) !== null) return null;
  const { productName, dosageForm, ingredients } = entry.fields;
  if (!isUsable(productName)) return unusableReason(entry, "Product name", productName);
  if (!isUsable(dosageForm)) return unusableReason(entry, "Dosage form", dosageForm);
  if (ingredients.length === 0) return `Active ingredient not recorded on ${sourceLabel(entry)} (${labelOf(entry)})`;
  for (const ing of ingredients) {
    if (!isUsable(ing.name)) return unusableReason(entry, "Active ingredient", ing.name);
    if (!isUsable(ing.strength)) return unusableReason(entry, "Strength", ing.strength);
  }
  return null;
}

export function checkRepeatedRecord({ entries }: CheckInput): CheckRun {
  const reasons = entries.length >= 2 ? entries.flatMap((e) => identityProblem(e) ?? []) : [];
  const findings: Finding[] = groupByProduct(entries)
    .filter((g) => g.length >= 2)
    .map((group) => {
      const name = labelOf(group[0]);
      const how = group[0].formulationId && group.every((e) => e.formulationId === group[0].formulationId)
        ? "the same catalog label"
        : "the same name, strength and form";
      return makeFinding({
        check: "repeated_record",
        discriminator: "product",
        entryIds: group.map((e) => e.id),
        title: `${name} is recorded ${group.length} times`,
        detail: `These ${group.length} records have ${how}, so they look like one product entered more than once. It is counted once when checking for shared ingredients.`,
        evidence: group.map((e) =>
          evidenceItem(e, "productName", `${labelOf(e)}, from ${sourceLabel(e)}`, e.fields.productName.evidence),
        ),
        labelWarningQuote: null,
        pharmacistQuestion: repeatQuestion(name, group.length),
      });
    });

  return buildRun("repeated_record", {
    findings,
    reasons,
    compared: entries.length >= 2,
    found: (n) => `Found ${plural(n, "medicine", "medicines")} recorded more than once`,
    noFinding: "No repeated medicines found in confirmed fields",
    notApplicable: "Fewer than two medicines on file",
  });
}
