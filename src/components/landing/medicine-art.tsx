import { cn } from "@/lib/utils";

/**
 * The landing illustration: a medicine bottle, a two-tone capsule, a scored tablet and a small pill
 * settle in one after another, then float. Decoration only (aria-hidden). Animated in CSS
 * (globals.css drop-in / float), so it runs before hydration and ends in place without JS; reduced
 * motion shows the end state at once. Theme tokens, so it works in light and dark.
 */
export function MedicineArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 140" aria-hidden className={cn("overflow-visible", className)}>
      <defs>
        <clipPath id="capsule-left">
          <rect x="-44" y="-18" width="44" height="36" />
        </clipPath>
      </defs>
      <g className="animate-float">
        {/* Bottle */}
        <g className="animate-drop-in">
          <rect x="22" y="40" width="64" height="86" rx="12" className="fill-ring-a/15 stroke-ring-a" strokeWidth="2.5" />
          <rect x="17" y="22" width="74" height="22" rx="6" className="fill-ring-a" />
          <line x1="30" y1="28" x2="30" y2="38" className="stroke-background/50" strokeWidth="2" strokeLinecap="round" />
          <line x1="40" y1="28" x2="40" y2="38" className="stroke-background/50" strokeWidth="2" strokeLinecap="round" />
          <line x1="50" y1="28" x2="50" y2="38" className="stroke-background/50" strokeWidth="2" strokeLinecap="round" />
          <rect x="31" y="62" width="46" height="40" rx="5" className="fill-card stroke-border" strokeWidth="1.5" />
          <line x1="38" y1="74" x2="70" y2="74" className="stroke-muted-foreground/60" strokeWidth="3" strokeLinecap="round" />
          <line x1="38" y1="83" x2="62" y2="83" className="stroke-muted-foreground/40" strokeWidth="3" strokeLinecap="round" />
          <line x1="38" y1="92" x2="66" y2="92" className="stroke-muted-foreground/40" strokeWidth="3" strokeLinecap="round" />
        </g>

        {/* Capsule: teal and amber halves */}
        <g className="animate-drop-in [animation-delay:120ms]">
          <g transform="translate(142 64) rotate(-32)">
            <rect x="-44" y="-18" width="88" height="36" rx="18" className="fill-overlap" />
            <rect x="-44" y="-18" width="88" height="36" rx="18" className="fill-primary" clipPath="url(#capsule-left)" />
            <rect x="-44" y="-18" width="88" height="36" rx="18" fill="none" className="stroke-foreground/15" strokeWidth="1.5" />
            <rect x="-34" y="-11" width="24" height="5" rx="2.5" className="fill-white/35" />
          </g>
        </g>

        {/* Scored tablet */}
        <g className="animate-drop-in [animation-delay:240ms]">
          {/* Seen at a slight angle, with its edge showing, so it reads as a tablet, not a sign. */}
          <ellipse cx="204" cy="109" rx="23" ry="19" className="fill-ring-b/40" />
          <ellipse cx="204" cy="103" rx="23" ry="19" className="fill-card stroke-ring-b" strokeWidth="2.5" />
          <line x1="193" y1="111" x2="215" y2="95" className="stroke-ring-b/70" strokeWidth="2.5" strokeLinecap="round" />
        </g>

        {/* Small pill */}
        <g className="animate-drop-in [animation-delay:360ms]">
          <ellipse cx="196" cy="34" rx="15" ry="9" transform="rotate(20 196 34)" className="fill-ring-b/30 stroke-ring-b" strokeWidth="2" />
        </g>
      </g>
    </svg>
  );
}
