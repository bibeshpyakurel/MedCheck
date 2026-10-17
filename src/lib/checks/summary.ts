// The one-line summary of the six check runs, for the checks panel and the report. It says how many
// checks actually compared confirmed values, so "6 checks run" never implies more than happened.
import type { CheckRun } from "@/lib/domain/schema";

/**
 * ["3 of 6 checks compared confirmed values", "1 found something", "1 couldn't be completed",
 * "2 had nothing to compare"]. Empty groups are left out; "found something" only once anything was compared.
 */
export function checksSummaryParts(runs: CheckRun[]): string[] {
  const count = (s: CheckRun["status"]) => runs.filter((r) => r.status === s).length;
  const found = count("finding");
  const compared = found + count("no_finding");
  const unresolved = count("unresolved");
  const nothing = count("not_applicable");
  return [
    compared === 0
      ? `None of the ${runs.length} checks could compare confirmed values yet`
      : `${compared} of ${runs.length} checks compared confirmed values`,
    compared > 0 ? `${found} found something` : null,
    unresolved > 0 ? `${unresolved} couldn't be completed` : null,
    nothing > 0 ? `${nothing} had nothing to compare` : null,
  ].filter((p): p is string => p !== null);
}
