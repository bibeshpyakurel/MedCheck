// Important warnings: every one, open, titled as the label prints it; then Took too much? with Poison Control.
import {
  BanIcon,
  HeartIcon,
  InfoIcon,
  type LucideIcon,
  MessageCircleQuestionIcon,
  OctagonXIcon,
  PhoneIcon,
  PillIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { LabelBullets, PoisonControlButton, SectionHeading } from "@/components/medicine-card/label-parts";
import type { LabelSectionKey } from "@/lib/domain/schema";
import type { LabelLine, WarningCard } from "@/lib/medication-facts";

const SECTION_ICONS: Partial<Record<LabelSectionKey, LucideIcon>> = {
  do_not_use: BanIcon,
  ask_doctor: MessageCircleQuestionIcon,
  ask_doctor_or_pharmacist: PillIcon,
  when_using: InfoIcon,
  stop_use: OctagonXIcon,
  pregnancy_or_breast_feeding: HeartIcon,
  keep_out_of_reach: ShieldAlertIcon,
};

const texts = (lines: LabelLine[]) => lines.map((l) => l.text);

function Headed({ card }: { card: WarningCard }) {
  return (
    <div className="space-y-2.5 rounded-2xl border border-finding/40 bg-finding-surface p-4">
      <h4 className="flex items-center gap-2 font-semibold text-finding-foreground">
        <TriangleAlertIcon aria-hidden className="size-4.5 shrink-0" />
        {card.title}
      </h4>
      {card.lead && <p className="text-[0.9375rem] leading-relaxed">{card.lead.text}</p>}
      <LabelBullets bullets={texts(card.lines)} />
    </div>
  );
}

function Section({ card }: { card: WarningCard }) {
  const Icon = (card.section && SECTION_ICONS[card.section]) || InfoIcon;
  return (
    <div className="space-y-2.5 rounded-2xl border bg-card p-4 shadow-xs">
      <h4 className="flex items-center gap-2 font-semibold">
        <Icon aria-hidden className="size-4.5 shrink-0 text-muted-foreground" />
        {card.title}
      </h4>
      <LabelBullets bullets={texts(card.lines)} />
    </div>
  );
}

export function WarningCards({ warnings, overdose, id }: { warnings: WarningCard[]; overdose: LabelLine[]; id: string }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <SectionHeading
        id={id}
        title="Important warnings"
        caption="Every warning on the label, always open. They apply to everyone who uses this product; MedCheck doesn't rank them for you."
      />
      {warnings.map((w, n) => (w.kind === "headed" ? <Headed key={n} card={w} /> : <Section key={n} card={w} />))}
      <div className="space-y-3 rounded-2xl border border-foreground/25 bg-card p-4 shadow-xs">
        <h4 className="flex items-center gap-2 font-semibold">
          <PhoneIcon aria-hidden className="size-4.5 shrink-0" />
          Took too much?
        </h4>
        <LabelBullets bullets={texts(overdose)} />
        <PoisonControlButton />
      </div>
    </section>
  );
}
