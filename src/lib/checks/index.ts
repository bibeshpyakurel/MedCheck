// The checks. Deterministic rules over confirmed label facts → findings. Evidence, not advice:
// nothing here computes a dose or says a combination is safe.
// The schema's CHECK_IDS still lists "document_vs_bottle"; that check was retired and never runs.
import { CHECK_IDS, type CheckId, type CheckInput, type CheckRun } from "@/lib/domain/schema";
import { checkConcentration } from "./concentration";
import { checkDatabaseVsBox } from "./database-vs-box";
import { checkIngredientOverlap } from "./overlap";
import { checkRepeatedRecord } from "./repeated";
import { checkUnits } from "./units";

export { productIdentity } from "./identity";
export { mgPerMl } from "./shared";

type ActiveCheckId = Exclude<CheckId, "document_vs_bottle">;

const CHECKS: Record<ActiveCheckId, (input: CheckInput) => CheckRun> = {
  ingredient_overlap: checkIngredientOverlap,
  repeated_record: checkRepeatedRecord,
  concentration: checkConcentration,
  units: checkUnits,
  database_vs_box: checkDatabaseVsBox,
};

/** The checks that run, in CHECK_IDS order. */
export const ACTIVE_CHECK_IDS: readonly ActiveCheckId[] = CHECK_IDS.filter((id): id is ActiveCheckId => id in CHECKS);

/**
 * Display names. Plain topics that read the same whatever the check's status, so a name never implies a
 * result. Only active checks have one.
 */
export const CHECK_TITLES: Readonly<Partial<Record<CheckId, string>>> = {
  ingredient_overlap: "Same ingredient in two medicines",
  repeated_record: "Same medicine listed twice",
  concentration: "Different liquid strengths",
  units: "Units in the amount and strength",
  database_vs_box: "Medicine listing and package",
} satisfies Record<ActiveCheckId, string>;

/** One run per active check, in order. Only confirmed entries are considered. */
export function runChecks(input: CheckInput): CheckRun[] {
  const scoped: CheckInput = { ...input, entries: input.entries.filter((e) => e.status === "confirmed") };
  return ACTIVE_CHECK_IDS.map((id) => CHECKS[id](scoped));
}
