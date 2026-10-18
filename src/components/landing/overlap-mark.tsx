import { cn } from "@/lib/utils";

// viewBox 200 × 120: rings r 44, centres 60 apart; they meet at x 100, y 60 ± 32.19.
const LENS = "M100 27.81 A44 44 0 0 1 100 92.19 A44 44 0 0 1 100 27.81 Z";

/**
 * The logo's idea at hero size: two medicines slide together and the part they share lights up amber.
 * Animated in CSS (globals.css ring-left / ring-right / lens-in), so it ends overlapped even without
 * JS. The stand-in for the Spline "landing-capsules" scene.
 */
export function OverlapMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" aria-hidden className={cn("overflow-visible", className)}>
      <defs>
        <filter id="lens-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      <g className="animate-float">
        <g className="animate-ring-left">
          <circle cx="70" cy="60" r="44" className="fill-ring-a/12 stroke-ring-a" strokeWidth="2.5" />
        </g>
        <g className="animate-ring-right">
          <circle cx="130" cy="60" r="44" className="fill-ring-b/12 stroke-ring-b" strokeWidth="2.5" />
        </g>
        <g className="animate-lens-in" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
          <path d={LENS} className="fill-overlap opacity-70" filter="url(#lens-glow)" />
          <path d={LENS} className="fill-overlap" />
        </g>
      </g>
    </svg>
  );
}
