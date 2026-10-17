// Summaries of the six check runs. checksSummaryParts: the one-line count for the checks screen and
// the report; it says how many checks actually compared confirmed values, so "6 checks run" never
// implies more than happened. attentionSummary: the compact status at the top of a person's medicines.
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

export type AttentionSummary = {
  /** "finding" when there are questions to ask, else "unresolved" when a check couldn't finish. Never a "good" tone. */
  tone: "finding" | "unresolved" | "neutral";
  headline: string; // "3 things to ask a pharmacist" | "No findings in confirmed fields" | "Nothing to compare yet"
  lead: string | null; // the first finding's title
  needsDetails: string | null; // "1 check needs more details", shown beside findings, never folded into them
};

export function attentionSummary(runs: CheckRun[]): AttentionSummary {
  const findings = runs.flatMap((r) => r.findings);
  const questions = new Set(findings.map((f) => f.pharmacistQuestion)).size;
  const unresolved = runs.filter((r) => r.status === "unresolved").length;
  const compared = runs.some((r) => r.status === "finding" || r.status === "no_finding");
  return {
    tone: questions > 0 ? "finding" : unresolved > 0 ? "unresolved" : "neutral",
    headline:
      questions > 0
        ? `${questions} ${questions === 1 ? "thing" : "things"} to ask a pharmacist`
        : compared || unresolved > 0
          ? "No findings in confirmed fields"
          : "Nothing to compare yet",
    lead: findings[0]?.title ?? null,
    needsDetails: unresolved > 0 ? `${unresolved} ${unresolved === 1 ? "check needs" : "checks need"} more details` : null,
  };
}
