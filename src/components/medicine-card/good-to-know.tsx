// Good to know: alcohol, food, drowsiness and allergies, by the label's own lines or the fixed "doesn't mention" line.
import { LabelBullets, SectionHeading } from "@/components/medicine-card/label-parts";
import { ShowOriginalButton } from "@/components/medicine-card/medicine-card-tabs";
import type { GoodToKnowTile } from "@/lib/medication-facts";

export function GoodToKnow({ tiles, id }: { tiles: GoodToKnowTile[]; id: string }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <SectionHeading id={id} title="Good to know" caption="Every line on the label that mentions it." />
      <ul className="grid gap-2 sm:grid-cols-2">
        {tiles.map((t) => (
          <li key={t.key} className="space-y-1.5 rounded-xl border bg-card p-3.5 shadow-xs">
            <h4 className="text-sm font-semibold text-muted-foreground">{t.title}</h4>
            {t.bullets.length > 0 ? (
              <LabelBullets bullets={t.bullets} />
            ) : (
              t.notOnLabel && <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">{t.notOnLabel}</p>
            )}
            {t.key === "allergies" && <ShowOriginalButton>See inactive ingredients on the Original FDA label</ShowOriginalButton>}
          </li>
        ))}
      </ul>
    </section>
  );
}
