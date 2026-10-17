// Check 6 — database vs box: for barcode entries, the catalog label (openFDA or fictional) differs
// from the values the user confirmed on their own Drug Facts photo. Only values whose evidence is a
// photo (crop/photo) count as "the box"; catalog-only values can't be compared with themselves.
import { formatStrength, isUsable } from "@/lib/domain/fields";
import type { CheckInput, CheckRun, Evidence, Finding, FindingEvidence, MedicationEntry } from "@/lib/domain/schema";
import { databaseQuestion } from "./questions";
import {
  buildRun,
  displayIngredientName,
  evidenceItem,
  labelOf,
  makeFinding,
  type Provenance,
  provenanceOf,
  strengthsMatch,
  unusableReason,
} from "./shared";
import { normalizeIngredient } from "@/lib/domain/ingredients";

const fromPhoto = (e: Evidence) => e.kind === "crop" || e.kind === "photo";

type Diff = { line: string; catalog: string; photo: string; photoFrom?: Provenance; evidence: FindingEvidence[] };

function hasPhotoEvidence(entry: MedicationEntry): boolean {
  const f = entry.fields;
  return [f.productName, f.dosageForm, f.instructions, f.doseAsWritten, f.max24h, ...f.ingredients.flatMap((i) => [i.name, i.strength])].some(
    (field) => fromPhoto(field.evidence),
  );
}

export function checkDatabaseVsBox({ entries, formulations }: CheckInput): CheckRun {
  const barcode = entries.filter((e) => e.inputMethod === "barcode");
  const reasons: string[] = [];
  const findings: Finding[] = [];
  let compared = false;

  for (const entry of barcode) {
    const label = labelOf(entry);
    const formulation = entry.formulationId ? formulations[entry.formulationId] : undefined;
    if (!formulation) {
      reasons.push(`Medicine listing not available for ${label}`);
      continue;
    }
    if (!hasPhotoEvidence(entry)) {
      reasons.push(`No Drug Facts photo to compare for ${label}`);
      continue;
    }

    const db = (text: string, field: string): FindingEvidence => ({
      ...evidenceItem(entry, field, text, { kind: "database", formulationId: formulation.id, text }),
      documentKind: null,
      documentDate: null,
    });
    const catalogText = (i: number) => {
      const c = formulation.activeIngredients[i];
      return `${displayIngredientName(c.name)} ${formatStrength(c.strength)}`;
    };

    const diffs: Diff[] = [];
    const reasonsBefore = reasons.length;
    const matched = new Set<number>();
    let allNamesReadable = true;
    const photoIngredients = entry.fields.ingredients
      .map((ing, index) => ({ ing, index }))
      .filter(({ ing }) => fromPhoto(ing.name.evidence) || fromPhoto(ing.strength.evidence));

    for (const { ing, index } of photoIngredients) {
      if (!isUsable(ing.name)) {
        allNamesReadable = false;
        reasons.push(unusableReason(entry, "Active ingredient", ing.name));
        continue;
      }
      const name = displayIngredientName(ing.name.value);
      const normalized = normalizeIngredient(ing.name.value);
      const ci = formulation.activeIngredients.findIndex(
        (c) => c.normalized === normalized || normalizeIngredient(c.name) === normalized,
      );
      const strengthUsable = isUsable(ing.strength) && fromPhoto(ing.strength.evidence);
      if (fromPhoto(ing.strength.evidence) && !isUsable(ing.strength)) {
        reasons.push(unusableReason(entry, "Strength", ing.strength));
      }
      const photoText = strengthUsable ? `${name} ${formatStrength(ing.strength.value!)}` : name;
      if (ci < 0) {
        compared = true;
        const from = provenanceOf(entry, ing.name);
        diffs.push({
          line:
            from === "entered"
              ? `For the Drug Facts photo, you entered ${photoText}, which the medicine listing doesn't list`
              : `The Drug Facts photo shows ${photoText}, which the medicine listing doesn't list`,
          catalog: `no ${name}`,
          photo: photoText,
          photoFrom: from,
          evidence: [evidenceItem(entry, `ingredients[${index}].name`, photoText, ing.name.evidence)],
        });
        continue;
      }
      matched.add(ci);
      if (!strengthUsable) continue;
      compared = true;
      const c = formulation.activeIngredients[ci];
      if (strengthsMatch(c.strength, ing.strength.value!)) continue;
      const from = provenanceOf(entry, ing.strength);
      diffs.push({
        line:
          from === "entered"
            ? `The medicine listing lists ${catalogText(ci)}; you entered ${photoText} for the Drug Facts photo`
            : `The medicine listing lists ${catalogText(ci)}; the Drug Facts photo you confirmed shows ${photoText}`,
        catalog: catalogText(ci),
        photo: photoText,
        photoFrom: from,
        evidence: [
          db(catalogText(ci), `catalog.activeIngredients[${ci}].strength`),
          evidenceItem(entry, `ingredients[${index}].strength`, photoText, ing.strength.evidence),
        ],
      });
    }

    // Catalog ingredients missing from the photo — only when every photo ingredient was fully readable.
    if (photoIngredients.length > 0 && allNamesReadable && reasons.length === reasonsBefore) {
      formulation.activeIngredients.forEach((c, ci) => {
        if (matched.has(ci)) return;
        const name = displayIngredientName(c.name);
        diffs.push({
          line: `The medicine listing lists ${catalogText(ci)}, which isn't among the values you confirmed from the photo`,
          catalog: catalogText(ci),
          photo: `no ${name}`,
          evidence: [db(catalogText(ci), `catalog.activeIngredients[${ci}]`)],
        });
      });
    }

    if (diffs.length === 0) continue;
    findings.push(
      makeFinding({
        check: "database_vs_box",
        discriminator: "photo",
        entryIds: [entry.id],
        title: `The package doesn't match the medicine listing: ${label}`,
        detail: `The barcode matched "${formulation.brandName}" in the database. ${diffs.map((d) => d.line).join(". ")}. MedCheck doesn't decide which is right.`,
        evidence: diffs.flatMap((d) => d.evidence),
        labelWarningQuote: null,
        pharmacistQuestion: databaseQuestion(label, diffs),
      }),
    );
  }

  return buildRun("database_vs_box", {
    findings,
    reasons,
    compared,
    found: (n) => `Found ${n === 1 ? "1 package that differs" : `${n} packages that differ`} from the medicine listing`,
    noFinding: "No differences between the medicine listing and the package found in confirmed fields",
    notApplicable: "No scanned medicine to compare with its listing",
  });
}
