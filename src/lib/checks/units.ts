// Check 4 — units: the dose as written and the strength use units that don't line up
// (tsp vs mL, an mg dose for a liquid, a dose with no measuring unit). Never converts units.
import { formatDose, formatStrength, isUsable } from "@/lib/domain/fields";
import type { CheckInput, CheckRun, Finding, MedicationEntry } from "@/lib/domain/schema";
import { unitsQuestion, type UnitsProblem } from "./questions";
import {
  buildRun,
  doseStatus,
  evidenceItem,
  formFamily,
  isMassUnit,
  isSpoonUnit,
  isVolumeUnit,
  labelOf,
  makeFinding,
  plural,
  sourceLabel,
  sourcePhrase,
  unusableReason,
} from "./shared";

const COUNT_UNIT =
  /^(tablet|caplet|capsule|softgel|liqui-?cap|gelcap|chewable|lozenge|packet|pill|piece|gumm(y|ies)|suppositor(y|ies)|patch|spray|drop)s?$/i;

function problemFor(doseUnit: string, liquid: boolean, perUnit: string | null): UnitsProblem | null {
  const u = doseUnit.trim();
  if (liquid) {
    if (isMassUnit(u)) return "mass_dose";
    if (isVolumeUnit(u)) return isVolumeUnit(perUnit) && isSpoonUnit(u) !== isSpoonUnit(perUnit) ? "volume_units" : null;
    return "unclear_unit";
  }
  if (isVolumeUnit(u)) return "volume_units";
  if (isMassUnit(u) || COUNT_UNIT.test(u)) return null;
  return "unclear_unit";
}

function describe(problem: UnitsProblem, dose: string, strength: string): { title: string; detail: string } {
  switch (problem) {
    case "volume_units":
      return {
        title: "Dose and strength use different units",
        detail: `The dose is written as ${dose}, but the strength is printed as ${strength}. These units don't line up.`,
      };
    case "mass_dose":
      return {
        title: "Dose written in mg for a liquid",
        detail: `The dose is written as ${dose}, but this liquid's strength is printed as ${strength}. The directions don't say what amount of liquid to measure.`,
      };
    case "unclear_unit":
      return {
        title: "Dose has no clear measuring unit",
        detail: `The dose is written as ${dose}, which isn't a measuring unit that matches the strength printed as ${strength}.`,
      };
  }
}

export function checkUnits({ entries }: CheckInput): CheckRun {
  const reasons: string[] = [];
  const findings: Finding[] = [];
  let compared = false;

  for (const entry of entries) {
    const ds = doseStatus(entry);
    if (ds.kind === "absent") continue;
    if (ds.kind === "unresolved") {
      reasons.push(ds.reason);
      continue;
    }
    const index = entry.fields.ingredients.findIndex((i) => isUsable(i.strength));
    if (index < 0) {
      reasons.push(strengthReason(entry));
      continue;
    }
    compared = true;
    const strengthField = entry.fields.ingredients[index].strength;
    const strength = strengthField.value!;
    const liquid = isVolumeUnit(strength.perUnit) || formFamily(entry) === "liquid";
    const problem = problemFor(ds.dose.unit, liquid, strength.perUnit);
    if (!problem) continue;

    const doseText = formatDose(ds.dose);
    const strengthText = formatStrength(strength);
    const { title, detail } = describe(problem, doseText, strengthText);
    findings.push(
      makeFinding({
        check: "units",
        discriminator: problem,
        entryIds: [entry.id],
        title: `${title}: ${labelOf(entry)}`,
        detail: `${sourceLabel(entry)}: ${detail}`,
        evidence: [
          evidenceItem(entry, "doseAsWritten", doseText, ds.field.evidence),
          evidenceItem(entry, `ingredients[${index}].strength`, strengthText, strengthField.evidence),
        ],
        labelWarningQuote: null,
        pharmacistQuestion: unitsQuestion(problem, sourcePhrase(entry), doseText, strengthText),
      }),
    );
  }

  return buildRun("units", {
    findings,
    reasons,
    compared,
    found: (n) => `Found ${plural(n, "unit mismatch", "unit mismatches")}`,
    noFinding: "No unit mismatches found in confirmed fields",
    notApplicable: "No medicine on file has a written dose to compare",
  });
}

function strengthReason(entry: MedicationEntry): string {
  const first = entry.fields.ingredients[0];
  if (!first) return `Strength not recorded on ${sourceLabel(entry)} (${labelOf(entry)})`;
  return unusableReason(entry, "Strength", first.strength);
}
