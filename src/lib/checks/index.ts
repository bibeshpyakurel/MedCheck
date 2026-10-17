// The six checks. Deterministic rules over confirmed label facts → findings and pharmacist
// questions. Evidence, not advice: nothing here computes a dose or says a combination is safe.
import { CHECK_IDS, type CheckId, type CheckInput, type CheckRun } from "@/lib/domain/schema";
import { checkConcentration } from "./concentration";
import { checkDatabaseVsBox } from "./database-vs-box";
import { checkDocumentVsBottle } from "./document-vs-bottle";
import { checkIngredientOverlap } from "./overlap";
import { checkRepeatedRecord } from "./repeated";
import { checkUnits } from "./units";

export { productIdentity } from "./identity";
export { mgPerMl } from "./shared";

const CHECKS: Record<CheckId, (input: CheckInput) => CheckRun> = {
  ingredient_overlap: checkIngredientOverlap,
  repeated_record: checkRepeatedRecord,
  concentration: checkConcentration,
  units: checkUnits,
  document_vs_bottle: checkDocumentVsBottle,
  database_vs_box: checkDatabaseVsBox,
};

/**
 * Display names for the checks screen and landing page. Plain topics that read the same whatever the
 * check's status ("Same ingredient in two medicines — no findings"), so a name never implies a result.
 */
export const CHECK_TITLES: Record<CheckId, string> = {
  ingredient_overlap: "Same ingredient in two medicines",
  repeated_record: "Same medicine listed twice",
  concentration: "Different liquid strengths",
  units: "Units in the amount and strength",
  document_vs_bottle: "Document and bottle",
  database_vs_box: "Medicine listing and package",
};

/** Always six runs, in CHECK_IDS order. Only confirmed entries are considered. */
export function runChecks(input: CheckInput): CheckRun[] {
  const scoped: CheckInput = { ...input, entries: input.entries.filter((e) => e.status === "confirmed") };
  return CHECK_IDS.map((id) => CHECKS[id](scoped));
}
