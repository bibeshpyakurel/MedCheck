// The "Checks run" panel. Never green: a clean result must not read as "safe".
import { cn } from "cn";
import { CHECK_TITLES } from "@/lib/checks";
import { checksSummaryParts } from "@/lib/checks/summary";
import type { CheckRun, CheckStatus, Formulation, MedicationEntry } from "@/lib/domain/schema";
import { FindingCard } from "./finding-card";

const STATUS: Record<CheckStatus, { label: string; className: string; dot: string; bar: string }> = {
  finding: {
    label: "Found something",
    className: "bg-finding-surface text-finding-foreground ring-finding/35",
    dot: "bg-finding",
    bar: "bg-finding",
  },
  unresolved: {
    label: "Couldn't be completed",
    className: "bg-unresolved-surface text-unresolved-foreground ring-unresolved/35",
    dot: "bg-unresolved",
    bar: "bg-unresolved",
  },
  no_finding: {
    label: "Nothing found",
    className: "bg-muted text-muted-foreground ring-border",
    dot: "bg-muted-foreground/60",
    bar: "bg-muted-foreground/35",
  },
  not_applicable: {
    label: "Not applicable",
    className: "bg-transparent text-muted-foreground ring-border",
    dot: "border border-muted-foreground/50",
    bar: "bg-border",
  },
};

export function checksSummaryLine(runs: CheckRun[]): string {
  return checksSummaryParts(runs).join(" · ");
}

/** Small status pill shared by the panel and other summaries. */
export function CheckStatusBadge({ status, className }: { status: CheckStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        s.className,
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
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
    <section
      aria-labelledby="checks-heading"
      className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm"
    >
      <div className="border-b bg-surface/60 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="checks-heading" className="text-lg font-semibold tracking-tight">
            Checks run
          </h2>
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground ring-1 ring-border">
            {runs.length} rules
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground nums">{checksSummaryLine(runs)}</p>
        {/* One segment per check, in panel order. */}
        <div aria-hidden className="mt-4 flex gap-1">
          {runs.map((run) => (
            <span key={run.check} className={cn("h-1.5 flex-1 rounded-full", STATUS[run.status].bar)} />
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Only values you confirmed are checked. MedCheck shows evidence; it doesn&apos;t give medical advice.
        </p>
      </div>

      <ol className="divide-y">
        {runs.map((run) => (
          <li key={run.check} className={cn("p-5", run.status === "not_applicable" && "bg-surface/40")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">{CHECK_TITLES[run.check]}</h3>
              <CheckStatusBadge status={run.status} />
            </div>
            <p className={cn("mt-1.5 text-sm", run.status === "not_applicable" && "text-muted-foreground")}>
              {run.summary}
            </p>

            {run.reasons.length > 0 && (
              <ul
                aria-label="Reasons"
                className={cn(
                  "mt-2 space-y-1 text-sm",
                  run.status === "not_applicable" ? "text-muted-foreground" : "text-unresolved-foreground",
                )}
              >
                {run.reasons.map((reason) => (
                  <li key={reason} className="flex gap-2">
                    <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-current opacity-70" />
                    {reason}
                  </li>
                ))}
              </ul>
            )}

            {run.findings.length > 0 && (
              <div className="mt-4 space-y-3">
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
        ))}
      </ol>
    </section>
  );
}
