// Check 5 — document vs bottle: the same ingredient, in the same kind of form (liquid or solid),
// appears on two or more kinds of document (prescription label, discharge list, bottle) and they
// disagree on strength or on the dose as written. The conflict is listed with dates and left for the
// pharmacist: MedCheck never decides which document is right.
import { formatDose, formatStrength, isUsable } from "@/lib/domain/fields";
import type { CheckInput, CheckRun, Evidence, Finding, MedicationEntry } from "@/lib/domain/schema";
import { doseQuestion, strengthQuestion, uniqueSides } from "./questions";
import {
  buildRun,
  documentClass,
  doseStatus,
  evidenceItem,
  formFamily,
  ingredientProblem,
  labelOf,
  makeFinding,
  plural,
  type Provenance,
  provenanceOf,
  sourceLabel,
  sourcePhrase,
  strengthKey,
  unusableReason,
  usableIngredients,
} from "./shared";

type Hit = { entry: MedicationEntry; index: number };

const NO_DECISION = "MedCheck doesn't decide which is right; ask a pharmacist.";

/** "Discharge list (2026-10-16)" or "Package label (Calmora …)". */
function dated(entry: MedicationEntry): string {
  const date = entry.sourceDocument?.documentDate;
  return date ? `${sourceLabel(entry)} (${date})` : `${sourceLabel(entry)} (${labelOf(entry)})`;
}

type Item = { entry: MedicationEntry; field: string; text: string; key: string; evidence: Evidence; from: Provenance };

function conflictFinding(ingredient: string, aspect: "strength" | "dose", items: Item[]): Finding {
  // "the bottle" is ambiguous when two different bottles are involved; name them instead.
  const bottles = new Set(items.filter((i) => documentClass(i.entry) === "bottle").map((i) => labelOf(i.entry)));
  const source = (i: Item) =>
    documentClass(i.entry) === "bottle" && bottles.size > 1 ? labelOf(i.entry) : sourcePhrase(i.entry, i.from);
  const lines = [
    ...new Set(items.map((i) => (i.from === "entered" ? `${dated(i.entry)}: you entered ${i.text}` : `${dated(i.entry)} says ${i.text}`))),
  ];
  const sides = uniqueSides(items.map((i) => ({ source: source(i), value: i.text, from: i.from })));
  return makeFinding({
    check: "document_vs_bottle",
    discriminator: `${ingredient}:${aspect}`,
    entryIds: items.map((i) => i.entry.id),
    title:
      aspect === "strength"
        ? `Your documents list different ${ingredient} strengths`
        : `Your documents write the ${ingredient} dose differently`,
    detail: `${lines.join("; ")}. ${NO_DECISION}`,
    evidence: items.map((i) => evidenceItem(i.entry, i.field, i.text, i.evidence)),
    labelWarningQuote: null,
    pharmacistQuestion: aspect === "strength" ? strengthQuestion(sides) : doseQuestion(sides),
  });
}

export function checkDocumentVsBottle({ entries }: CheckInput): CheckRun {
  const docs = entries.filter((e) => documentClass(e) !== null);
  const groups = new Map<string, Hit[]>(); // `${ingredient}|${family}`
  for (const entry of docs) {
    const family = formFamily(entry) ?? "unknown";
    for (const ing of usableIngredients(entry)) {
      const key = `${ing.normalized}|${family}`;
      groups.set(key, [...(groups.get(key) ?? []), { entry, index: ing.index }]);
    }
  }

  const reasons: string[] = [];
  const findings: Finding[] = [];
  let compared = false;

  for (const [key, hits] of groups) {
    const classes = new Set(hits.map((h) => documentClass(h.entry)));
    if (classes.size < 2) continue;
    const ingredient = key.split("|")[0];

    // Strength
    const strengths: Item[] = hits.flatMap((h) => {
      const field = h.entry.fields.ingredients[h.index].strength;
      if (!isUsable(field)) {
        reasons.push(unusableReason(h.entry, "Strength", field));
        return [];
      }
      const s = field.value;
      return [
        {
          entry: h.entry,
          field: `ingredients[${h.index}].strength`,
          text: formatStrength(s),
          key: strengthKey(s),
          evidence: field.evidence,
          from: provenanceOf(h.entry, field),
        },
      ];
    });

    // Dose as written (only where a dose is written; catalog labels often have none)
    const doses: Item[] = hits.flatMap((h) => {
      const ds = doseStatus(h.entry);
      if (ds.kind === "unresolved") reasons.push(ds.reason);
      if (ds.kind !== "usable") return [];
      const key = `${ds.dose.amount}|${ds.dose.unit.trim().toLowerCase().replace(/s$/, "")}`;
      return [
        { entry: h.entry, field: "doseAsWritten", text: formatDose(ds.dose), key, evidence: ds.field.evidence, from: provenanceOf(h.entry, ds.field) },
      ];
    });

    for (const [aspect, items] of [
      ["strength", strengths],
      ["dose", doses],
    ] as const) {
      if (new Set(items.map((i) => documentClass(i.entry))).size < 2) continue;
      compared = true;
      if (new Set(items.map((i) => i.key)).size < 2) continue;
      findings.push(conflictFinding(ingredient, aspect, items));
    }
  }

  // An unreadable ingredient name might hide a conflict once more than one kind of document is on file.
  if (new Set(docs.map(documentClass)).size >= 2) reasons.push(...docs.flatMap((e) => ingredientProblem(e) ?? []));

  return buildRun("document_vs_bottle", {
    findings,
    reasons,
    compared,
    found: (n) => `Found ${plural(n, "disagreement", "disagreements")} between documents`,
    noFinding: "No disagreements between documents found in confirmed fields",
    notApplicable: "No medicine is on two kinds of document (prescription, discharge list, bottle) to compare",
  });
}
