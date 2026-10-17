// Check 3 — concentration: liquids with the same ingredient but different strengths. Both strengths
// are stated exactly as printed. mg per mL is used internally to compare and is never displayed;
// no volume is ever suggested or computed.
import { formatStrength } from "@/lib/domain/fields";
import type { CheckInput, CheckRun, Finding, MedicationEntry, Strength } from "@/lib/domain/schema";
import { strengthQuestion, type Side, uniqueSides } from "./questions";
import {
  buildRun,
  displayIngredientName,
  evidenceItem,
  formFamily,
  ingredientProblem,
  isVolumeUnit,
  labelOf,
  makeFinding,
  mgPerMl,
  plural,
  PROVENANCE_NOTE,
  provenanceOf,
  strengthKey,
  unusableReason,
  usableIngredients,
} from "./shared";

type Known = { entry: MedicationEntry; index: number; name: string; strength: Strength };

export function checkConcentration({ entries }: CheckInput): CheckRun {
  // Liquids, plus entries whose form can't be told (they might be liquids).
  const candidates = entries.filter((e) => formFamily(e) !== "solid");
  const known = new Map<string, Known[]>();
  const uncertain = new Map<string, { entry: MedicationEntry; reason: string }[]>();
  const add = <T,>(m: Map<string, T[]>, k: string, v: T) => m.set(k, [...(m.get(k) ?? []), v]);

  for (const entry of candidates) {
    const family = formFamily(entry);
    for (const ing of usableIngredients(entry)) {
      const s = ing.strength;
      if (s && mgPerMl(s) !== null) {
        add(known, ing.normalized, { entry, index: ing.index, name: ing.name, strength: s });
      } else if (!s) {
        add(uncertain, ing.normalized, { entry, reason: unusableReason(entry, "Strength", ing.strengthField) });
      } else if (family === "liquid" || isVolumeUnit(s.perUnit)) {
        add(uncertain, ing.normalized, {
          entry,
          reason: `Strength on ${labelOf(entry)} (${formatStrength(s)}) isn't printed per mL, so it can't be compared`,
        });
      }
    }
  }

  const reasons: string[] = [];
  const findings: Finding[] = [];
  let compared = false;

  const ingredients = new Set([...known.keys(), ...uncertain.keys()]);
  for (const ingredient of ingredients) {
    const k = known.get(ingredient) ?? [];
    const u = uncertain.get(ingredient) ?? [];
    const distinctEntries = new Set([...k, ...u].map((x) => x.entry.id));
    if (distinctEntries.size < 2) continue;
    reasons.push(...u.map((x) => x.reason));
    if (new Set(k.map((x) => x.entry.id)).size >= 2) compared = true;
    if (new Set(k.map((x) => strengthKey(x.strength))).size < 2) continue;

    const shown = displayIngredientName(k[0].name);
    const sides = k.map((x) => ({
      label: labelOf(x.entry),
      value: formatStrength(x.strength),
      from: provenanceOf(x.entry, x.entry.fields.ingredients[x.index].strength),
    }));
    const lines = [...new Set(sides.map((s) => `${s.label}: ${s.value}${PROVENANCE_NOTE[s.from]}`))];
    const asPrinted = sides.every((s) => s.from === "label") ? "As printed" : "As recorded";
    const questionSides: Side[] = uniqueSides(
      sides.map((s) => ({ source: s.from === "described" ? `my description of ${s.label}` : s.label, value: s.value, from: s.from })),
    );
    findings.push(
      makeFinding({
        check: "concentration",
        discriminator: ingredient,
        entryIds: k.map((x) => x.entry.id),
        title: `These liquids have different strengths of ${shown}`,
        detail: `The same volume holds different amounts of ${ingredient} in these liquids. ${asPrinted}: ${lines.join("; ")}.`,
        evidence: k.map((x) =>
          evidenceItem(
            x.entry,
            `ingredients[${x.index}].strength`,
            formatStrength(x.strength),
            x.entry.fields.ingredients[x.index].strength.evidence,
          ),
        ),
        labelWarningQuote: null,
        pharmacistQuestion: strengthQuestion(questionSides),
      }),
    );
  }

  // An unreadable ingredient name on a (possible) liquid matters once there's another liquid to compare.
  if (candidates.length >= 2) reasons.push(...candidates.flatMap((e) => ingredientProblem(e) ?? []));

  return buildRun("concentration", {
    findings,
    reasons,
    compared,
    found: (n) => `Found ${plural(n, "ingredient", "ingredients")} in liquids with different strengths`,
    noFinding: "No differing liquid strengths found in confirmed fields",
    notApplicable: "No two liquids with the same ingredient to compare",
  });
}
