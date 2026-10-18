// One form's directions: general lines and age cards in label order, marked words highlighted in place.
import { ClockIcon, InfoIcon, type LucideIcon, UsersIcon } from "lucide-react";
import { MarkedLine } from "@/components/medicine-card/label-parts";
import { type DirectionBlock, type DirectionSegment, isDailyLimit, type LabelLine } from "@/lib/medication-facts";
import { cn } from "@/lib/utils";

/** A clock on a line about the most in 24 hours; otherwise `fallback`, if any. */
function LineIcon({ line, fallback: Fallback }: { line: LabelLine; fallback?: LucideIcon }) {
  if (isDailyLimit(line.text)) return <ClockIcon aria-hidden className="mt-1 size-4 shrink-0 text-accent-foreground" />;
  return Fallback ? <Fallback aria-hidden className="mt-1 size-4 shrink-0 text-muted-foreground" /> : null;
}

function GeneralCard({ lines }: { lines: LabelLine[] }) {
  return (
    <ul className="divide-y rounded-2xl border bg-surface px-4">
      {lines.map((l, n) => (
        <li key={n} className="flex gap-2.5 py-3">
          <LineIcon line={l} fallback={InfoIcon} />
          <p className="text-[0.9375rem] leading-relaxed">
            <MarkedLine line={l} />
          </p>
        </li>
      ))}
    </ul>
  );
}

function AgeCard({ segment }: { segment: DirectionSegment }) {
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-xs">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-accent-foreground uppercase">
        <UsersIcon aria-hidden className="size-3.5" />
        {segment.age}
      </h4>
      <ul className="space-y-3">
        {segment.lines.map((l, n) => (
          <li key={n} className={cn("flex gap-2.5", n > 0 && "border-t border-dashed pt-3")}>
            <LineIcon line={l} />
            <p className="text-[0.9375rem] leading-relaxed">
              <MarkedLine line={l} />
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DirectionBlockView({ block }: { block: DirectionBlock }) {
  return (
    <div className="space-y-2.5">
      {block.segments.map((s, n) => (s.age ? <AgeCard key={n} segment={s} /> : <GeneralCard key={n} lines={s.lines} />))}
    </div>
  );
}

/** The label's 24-hour limit when no directions line already says it. */
export function LimitCard({ line }: { line: LabelLine }) {
  return (
    <div className="flex gap-2.5 rounded-2xl border bg-card p-4 shadow-xs">
      <ClockIcon aria-hidden className="mt-1 size-4 shrink-0 text-accent-foreground" />
      <p className="text-[0.9375rem] leading-relaxed">
        <MarkedLine line={line} />
      </p>
    </div>
  );
}
