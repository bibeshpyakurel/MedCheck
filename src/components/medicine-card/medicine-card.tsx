// The medicine card: a dashboard over the FDA label (Quick View) and the label as published (Original
// FDA label), in the label's own words throughout. Evidence only: no dose maths, no "safe", and the
// dosing table is shown in full with no row picked. No "use client": it renders on the server and inside
// the client sheet alike; the tabs and the per-form switch are client children.
import { BuildingIcon, CalendarIcon, InfoIcon, type LucideIcon, PillIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PoisonControlButton } from "@/components/medicine-card/label-parts";
import { type CardTab, MedicineCardTabs } from "@/components/medicine-card/medicine-card-tabs";
import { OriginalLabel } from "@/components/medicine-card/original-label";
import { QuickView } from "@/components/medicine-card/quick-view";
import type { Formulation } from "@/lib/domain/schema";
import { medicationFacts, STATUS_TEXT } from "@/lib/medication-facts";
import { formatDocDate } from "@/lib/record-format";

function Meta({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <Icon aria-hidden className="size-4 shrink-0" />
      {children}
    </li>
  );
}

/**
 * `showTitle={false}` when the container already shows the brand name (the sheet's sticky title).
 * `actions` sit under the status chip (Compare with my medicines); `defaultTab` opens on the Original label.
 * `dosageTableHtml` must arrive sanitized: `rowToFormulation()` does that on every catalog read.
 */
export function MedicineCard({
  formulation: f,
  showTitle = true,
  actions,
  defaultTab = "quick",
}: {
  formulation: Formulation;
  showTitle?: boolean;
  actions?: ReactNode;
  defaultTab?: CardTab;
}) {
  const facts = medicationFacts(f);
  const { header } = facts;
  const labelDate = formatDocDate(header.labelDate);

  return (
    <article className="space-y-6">
      <header className="space-y-3">
        {showTitle && <h2 className="font-display text-2xl font-semibold tracking-tight text-balance">{header.name}</h2>}
        {header.ingredients.length > 0 && (
          <ul className="space-y-1 text-base font-semibold nums">
            {header.ingredients.map((line, n) => (
              <li key={n}>{line}</li>
            ))}
          </ul>
        )}
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {header.labeler && <Meta icon={BuildingIcon}>{header.labeler}</Meta>}
          {labelDate && <Meta icon={CalendarIcon}>Label dated {labelDate}</Meta>}
          {header.dosageForm && <Meta icon={PillIcon}>{header.dosageForm.charAt(0).toUpperCase() + header.dosageForm.slice(1)}</Meta>}
        </ul>
        <p className="inline-flex items-center gap-1.5 rounded-full border bg-surface px-2.5 py-1 text-xs font-medium">
          <InfoIcon aria-hidden className="size-3.5" />
          {STATUS_TEXT[header.status]}
        </p>
        {actions}
      </header>

      <MedicineCardTabs
        defaultTab={defaultTab}
        quick={<QuickView facts={facts} idPrefix={`card-${f.id}`} />}
        original={<OriginalLabel formulation={f} />}
      />

      <footer>
        <PoisonControlButton />
      </footer>
    </article>
  );
}
