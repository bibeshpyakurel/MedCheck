// The medicine card: quick answers first, then everything the FDA label says (collapsed), all in the
// label's own words. Evidence only: no dose maths, no "safe", and the dosing table is shown in full
// with no row picked. No "use client": it renders on the server and inside the client sheet alike.
import { ChevronDownIcon, ExternalLinkIcon, InfoIcon } from "lucide-react";
import { DosingTable, LabelBullets, PoisonControlButton } from "@/components/medicine-card/label-parts";
import { QuickAnswers } from "@/components/medicine-card/quick-answers";
import { formatStrength } from "@/lib/domain/fields";
import type { Formulation } from "@/lib/domain/schema";
import { cardSections } from "@/lib/medicine-card";
import { formatDocDate } from "@/lib/record-format";

/**
 * `showTitle={false}` when the container already shows the brand name (the sheet's sticky title).
 * `dosageTableHtml` must arrive sanitized: `rowToFormulation()` does that on every catalog read.
 */
export function MedicineCard({ formulation: f, showTitle = true }: { formulation: Formulation; showTitle?: boolean }) {
  const sections = cardSections(f);
  const labelDate = formatDocDate(f.labelEffectiveDate);
  const byline = [f.labelerName, labelDate && `Label dated ${labelDate}`].filter(Boolean).join(" · ");
  const id = (key: string) => `card-${f.id}-${key}`;

  return (
    <article className="space-y-6">
      <header className="space-y-3">
        {showTitle && (
          <h2 className="font-display text-2xl font-semibold tracking-tight text-balance">{f.brandName}</h2>
        )}
        {f.activeIngredients.length > 0 && (
          <ul className="space-y-1 text-base font-medium nums">
            {f.activeIngredients.map((i) => (
              <li key={`${i.name}-${formatStrength(i.strength)}`}>
                {i.name} {formatStrength(i.strength)}
              </li>
            ))}
          </ul>
        )}
        {byline && <p className="text-sm text-muted-foreground">{byline}</p>}
        {f.isFictional && <p className="text-sm text-muted-foreground">Fictional demo label, not a real product.</p>}
        {!f.reviewed && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            Not hand-checked. Copied from the FDA label as published.
          </p>
        )}
      </header>

      <QuickAnswers formulation={f} />

      {sections.length > 0 && (
        <details className="group border-y">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 py-2 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block font-display text-lg font-semibold tracking-tight">Everything on the label</span>
              <span className="block text-sm text-muted-foreground">Every Drug Facts section, as printed</span>
            </span>
            <ChevronDownIcon aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="divide-y border-t">
            {sections.map((section) => (
              <section key={section.key} aria-labelledby={id(section.key)} className="space-y-3 py-5">
                <h3 id={id(section.key)} className="text-base font-semibold">
                  {section.heading}
                </h3>
                <LabelBullets bullets={section.bullets} />
                {section.key === "directions" && f.dosageTableHtml && <DosingTable html={f.dosageTableHtml} />}
              </section>
            ))}
          </div>
        </details>
      )}

      <footer className="space-y-5">
        {f.sourceLinks.length > 0 && (
          <section aria-labelledby={id("sources")} className="space-y-1">
            <h3 id={id("sources")} className="text-sm font-semibold">
              Sources
            </h3>
            <ul>
              {f.sourceLinks.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {link.label}
                    <ExternalLinkIcon aria-hidden className="size-3.5" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
        <PoisonControlButton />
      </footer>
    </article>
  );
}
