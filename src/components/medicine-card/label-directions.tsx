// Label directions: the label's own sentences by form and age, the 24-hour limit, and the dosing table whole.
import { DirectionBlockView, LimitCard } from "@/components/medicine-card/direction-block";
import { DirectionForms } from "@/components/medicine-card/direction-forms";
import { DosingTable, SectionHeading } from "@/components/medicine-card/label-parts";
import type { Directions } from "@/lib/medication-facts";

export function LabelDirections({ directions: d, id }: { directions: Directions; id: string }) {
  if (d.blocks.length === 0 && !d.max24h && !d.dosageTableHtml) return null;
  const shared = d.blocks.filter((b) => !b.heading);
  const forms = d.blocks.filter((b) => b.heading);
  return (
    <section aria-labelledby={id} className="space-y-3">
      <SectionHeading
        id={id}
        title="Label directions"
        caption="The label's own sentences. Highlights mark amounts and times; nothing is removed, reworded or worked out for you."
      />
      {shared.map((b, n) => (
        <DirectionBlockView key={n} block={b} />
      ))}
      {forms.length > 0 && <DirectionForms blocks={forms} />}
      {d.max24h && <LimitCard line={d.max24h} />}
      {d.dosageTableHtml && <DosingTable html={d.dosageTableHtml} />}
    </section>
  );
}
