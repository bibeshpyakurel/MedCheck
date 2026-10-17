// The "Checks run" panel. Never green: a clean result must not read as "safe".
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { CHECK_TITLES } from "@/lib/checks";
import { checksSummaryParts } from "@/lib/checks/summary";
import type { CheckRun, CheckStatus, Formulation, MedicationEntry } from "@/lib/domain/schema";
import { FindingCard } from "./finding-card";

const STATUS: Record<CheckStatus, { label: string; className: string }> = {
  finding: { label: "Found something", className: "border-finding/50 bg-finding-surface text-finding-foreground" },
  unresolved: {
    label: "Couldn't be completed",
    className: "border-unresolved/50 bg-unresolved-surface text-unresolved-foreground",
  },
  no_finding: { label: "Nothing found", className: "border-border bg-muted text-muted-foreground" },
  not_applicable: { label: "Not applicable", className: "border-border bg-muted text-muted-foreground" },
};

export function checksSummaryLine(runs: CheckRun[]): string {
  return checksSummaryParts(runs).join(" · ");
}

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
  return (
    <section aria-labelledby="checks-heading" className="rounded-xl border bg-card p-4 text-card-foreground">
      <h2 id="checks-heading" className="text-lg font-semibold">
        Checks run
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{checksSummaryLine(runs)}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Only values you confirmed are checked. MedCheck shows evidence; it doesn&apos;t give medical advice.
      </p>

      <ol className="mt-4 space-y-3">
        {runs.map((run) => {
          const status = STATUS[run.status];
          return (
            <li key={run.check} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">{CHECK_TITLES[run.check]}</h3>
                <Badge variant="outline" className={cn("h-6 px-2.5", status.className)}>
                  {status.label}
                </Badge>
              </div>
              <p className="mt-1 text-sm">{run.summary}</p>

              {run.reasons.length > 0 && (
                <ul
                  aria-label="Reasons"
                  className={cn(
                    "mt-2 list-disc space-y-1 pl-5 text-sm",
                    run.status === "not_applicable" ? "text-muted-foreground" : "text-unresolved-foreground",
                  )}
                >
                  {run.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}

              {run.findings.length > 0 && (
                <div className="mt-3 space-y-3">
                  {run.findings.map((finding) => (
                    <FindingCard
                      key={finding.id}
                      finding={finding}
                      patientId={patientId}
                      entries={byId}
                      formulations={formulations}
                    />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
