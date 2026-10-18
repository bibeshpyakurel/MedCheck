// Different concentrations: one bar per bottle on a shared scale, each labelled with its strength as
// printed. The scale is the check's mg per mL, never shown; no volume is suggested or worked out.
import { CONCENTRATION_SENTENCE, type ConcentrationBar } from "@/lib/compare-view";

export function ConcentrationBars({ bars }: { bars: ConcentrationBar[] }) {
  const label = `Strength of each bottle, as printed: ${bars.map((b) => `${b.name}, ${b.strength}`).join("; ")}.`;
  return (
    <figure className="space-y-3 rounded-xl border bg-card p-3.5">
      <figcaption className="text-[0.9375rem] leading-relaxed font-medium text-pretty">{CONCENTRATION_SENTENCE}</figcaption>
      <div role="img" aria-label={label} className="space-y-2.5">
        {bars.map((b) => (
          <div key={b.entryId} className="space-y-1">
            <p className="text-sm">
              <span className="font-medium">{b.name}</span> · <span className="font-semibold nums">{b.strength}</span>
            </p>
            <div className="h-3 rounded-full bg-muted">
              <div className="h-3 rounded-full bg-finding" style={{ width: `${Math.max(b.ratio * 100, 4)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </figure>
  );
}
