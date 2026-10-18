import { cn } from "@/lib/utils";

/** A check mark that draws itself in 250 ms (globals.css `draw`). Give it a `key` to replay it. */
export function DrawnCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-4 shrink-0", className)} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} strokeDasharray={1} className="animate-draw" />
    </svg>
  );
}
