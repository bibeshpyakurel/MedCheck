import { cn } from "@/lib/utils";

const CORNERS = [
  "top-0 left-0 rounded-tl-lg border-t-[3px] border-l-[3px]",
  "top-0 right-0 rounded-tr-lg border-t-[3px] border-r-[3px]",
  "bottom-0 left-0 rounded-bl-lg border-b-[3px] border-l-[3px]",
  "bottom-0 right-0 rounded-br-lg border-b-[3px] border-r-[3px]",
];

/**
 * The chosen photo, framed. While it's being read, corner brackets close in and a beam sweeps the
 * label, so the step never looks frozen. It tracks the real read: no timer, no fake progress. Under
 * reduced motion the beam is hidden and the status line below says what's happening.
 */
export function ScanFrame({ src, scanning }: { src: string; scanning: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-muted shadow-xs">
      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
      <img src={src} alt="Your photo" className="max-h-64 w-full object-contain" />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute transition-[inset,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          scanning ? "inset-[8%] opacity-100" : "inset-2 opacity-0",
        )}
      >
        {CORNERS.map((corner) => (
          <span key={corner} className={cn("absolute size-7 border-primary", corner)} />
        ))}
        {scanning && (
          <span className="absolute inset-x-1 h-0.5 animate-scan rounded-full bg-primary shadow-[0_0_14px_3px_color-mix(in_oklab,var(--primary)_55%,transparent)] motion-reduce:hidden" />
        )}
      </div>
    </div>
  );
}
