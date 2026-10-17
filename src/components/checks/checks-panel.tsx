// The checks screen: findings first, then all six checks grouped by what happened.
// Never green: a clean result must not read as "safe", and a check that didn't run is not a clean result.
import { cn } from "cn";
import { CHECK_TITLES } from "@/lib/checks";
import { checksSummaryParts } from "@/lib/checks/summary";
import type { CheckRun, CheckStatus, Formulation, MedicationEntry } from "@/lib/domain/schema";
import { FindingCard } from "./finding-card";

/** Status dots for the group headings. Always beside text, never color alone. */
const DOT: Record<CheckStatus, string> = {
  finding: "bg-finding",
  unresolved: "bg-unresolved",
  no_finding: "bg-muted-foreground/60",
  not_applicable: "border border-muted-foreground/50",
};

/** The four states, kept apart, in the order they matter. */
const GROUPS: { status: CheckStatus; title: string; description: string }[] = [
  { status: "finding", title: "Found something", description: "The questions above came from these checks." },
  {
    status: "unresolved",
    title: "Needs more details",
    description: "These couldn't finish because a detail is missing or not confirmed yet. That is not a clean result.",
  },
  {
    status: "no_finding",
    title: "Ran — no findings in confirmed fields",
    description: "These compared the details you confirmed and found nothing to point out. Unknown details weren't compared.",
  },
  {
    status: "not_applicable",
    title: "Didn't apply",
    description: "There was nothing for these to compare yet.",
  },
];

export function ChecksPanel({
  runs,
  patientId,
  entries,
  formulations,
}: {
  runs: CheckRun[];
  patientId: string;
  /** The entries the checks ran on, to say which values the user typed and link each one to its source. */
  entries: MedicationEntry[];
  formulations: Record<string, Formulation>;
}) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const findings = runs.flatMap((r) => r.findings);
  return (
    <div className="space-y-10">
      <section aria-labelledby="questions-heading" className="space-y-4">
        <h2 id="questions-heading" className="text-lg font-semibold">
          {findings.length === 0
            ? "Things to ask a pharmacist"
            : `${findings.length} ${findings.length === 1 ? "thing" : "things"} to ask a pharmacist`}
        </h2>
        {findings.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-5 text-muted-foreground">
            No questions came up from the details you confirmed. This doesn&apos;t cover details that are unknown or
            still waiting for review.
          </p>
        ) : (
          findings.map((finding) => (
            <FindingCard key={finding.id} finding={finding} patientId={patientId} entries={byId} formulations={formulations} />
          ))
        )}
      </section>

      <section aria-labelledby="all-checks-heading" className="space-y-4">
        <div>
          <h2 id="all-checks-heading" className="text-lg font-semibold">
            All {runs.length} checks
          </h2>
          <p className="mt-1 text-sm text-muted-foreground nums">{checksSummaryParts(runs).join(" · ")}</p>
        </div>
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          {GROUPS.map((group) => {
            const inGroup = runs.filter((r) => r.status === group.status);
            if (inGroup.length === 0) return null;
            const headingId = `checks-${group.status}`;
            return (
              <section key={group.status} aria-labelledby={headingId} className="p-4 sm:p-5">
                <h3 id={headingId} className="flex items-center gap-2 font-semibold">
                  <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[group.status])} />
                  {group.title} ({inGroup.length})
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{group.description}</p>
                <ul className="mt-3 space-y-3">
                  {inGroup.map((run) => (
                    <CheckRow key={run.check} run={run} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/**
 * One check: its name, then what happened. Unresolved and not-applicable runs say it with their specific
 * reasons (their summary only repeats the first one); a run with findings still lists entries it skipped.
 */
function CheckRow({ run }: { run: CheckRun }) {
  const reasonsOnly = run.status === "not_applicable" || run.status === "unresolved";
  return (
    <li className="rounded-xl bg-surface/60 px-3.5 py-3">
      <p className="font-medium">{CHECK_TITLES[run.check]}</p>
      {reasonsOnly ? null : <p className="mt-0.5 text-sm text-muted-foreground">{run.summary}</p>}
      {run.reasons.length > 0 && (
        <div className="mt-1 text-sm">
          {run.status !== "not_applicable" ? (
            <p className="font-medium text-unresolved-foreground">
              {run.status === "finding" ? "Some medicines couldn't be compared:" : "This check needs:"}
            </p>
          ) : null}
          <ul
            aria-label={run.status === "not_applicable" ? "Reason" : "Missing details"}
            className={cn("space-y-0.5", run.status === "not_applicable" ? "text-muted-foreground" : "text-unresolved-foreground")}
          >
            {run.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}
