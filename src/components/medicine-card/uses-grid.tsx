// What it's for: the label's Uses as tiles, word for word; the icons are decoration only.
import { ActivityIcon, CircleDotIcon, FlameIcon, type LucideIcon, MoonIcon, SnowflakeIcon, ThermometerIcon, WindIcon, ZapIcon } from "lucide-react";
import { SectionHeading } from "@/components/medicine-card/label-parts";
import type { UseGroup, UseIcon } from "@/lib/medication-facts";
import { cn } from "@/lib/utils";

const ICONS: Record<UseIcon, LucideIcon> = {
  zap: ZapIcon,
  thermometer: ThermometerIcon,
  snowflake: SnowflakeIcon,
  wind: WindIcon,
  moon: MoonIcon,
  flame: FlameIcon,
  activity: ActivityIcon,
  dot: CircleDotIcon,
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function UsesGrid({ groups, id }: { groups: UseGroup[]; id: string }) {
  if (groups.length === 0) return null;
  return (
    <section aria-labelledby={id} className="space-y-3">
      <SectionHeading id={id} title="What it's for" caption="The label's Uses, word for word." />
      {groups.map((g, n) => (
        <div key={n} className="space-y-2">
          {g.lead && <p className="text-[0.9375rem] font-semibold">{capitalize(g.lead.text)}</p>}
          <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {g.tiles.map((t, k) => {
              const Icon = ICONS[t.icon];
              return (
                <li
                  key={k}
                  className={cn(
                    "flex min-h-11 items-center gap-2.5 rounded-xl border bg-card p-3 text-[0.9375rem] leading-snug shadow-xs",
                    t.text.length > 40 && "col-span-2 md:col-span-3",
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Icon aria-hidden className="size-4" />
                  </span>
                  {t.text}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
