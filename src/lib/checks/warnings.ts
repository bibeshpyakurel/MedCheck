// What the Medicines tab shows from the check runs: the actual findings as warnings, and plain lines
// for everything else. Never green and never "safe": with no findings it says only that nothing was
// found in the details the user confirmed, and only when something was actually compared. Pure.
import type { CheckRun, Finding } from "@/lib/domain/schema";

export const NONE_FOUND_LINE = "No shared ingredients or other warnings found in the details you confirmed.";
export const NOTHING_TO_COMPARE_LINE = "Nothing to compare yet. Add another medicine to look for shared ingredients.";
export const INCOMPLETE_LINE = "Some details are missing or not confirmed yet, so MedCheck can't compare them.";

export type WarningsView = {
  /** Every finding, once, in check order. */
  warnings: Finding[];
  /** The neutral line when there are no warnings; null when there are, or when nothing could finish at all. */
  emptyLine: string | null;
  /** Shown whenever a check couldn't compare everything (pending or unknown details). */
  incompleteLine: string | null;
};

export function warningsView(runs: CheckRun[]): WarningsView {
  const seen = new Set<string>();
  const warnings = runs
    .flatMap((r) => r.findings)
    .filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)));
  const incomplete = runs.some((r) => r.status === "unresolved" || (r.status === "finding" && r.reasons.length > 0));
  const compared = runs.some((r) => r.status === "finding" || r.status === "no_finding");

  let emptyLine: string | null = null;
  if (warnings.length === 0) {
    if (compared) emptyLine = NONE_FOUND_LINE;
    else if (!incomplete) emptyLine = NOTHING_TO_COMPARE_LINE;
  }
  return { warnings, emptyLine, incompleteLine: incomplete ? INCOMPLETE_LINE : null };
}
