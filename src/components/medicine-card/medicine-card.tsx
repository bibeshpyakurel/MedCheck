// The medicine card: everything the FDA label says, under plain headings, in the label's own words.
// Evidence only: no dose maths, no "safe", and the dosing table is shown in full with no row picked.
// No "use client": it renders on the server (entry page) and inside the client sheet alike.
import { ExternalLinkIcon, InfoIcon, PhoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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

      <div className="divide-y border-y">
        {sections.map((section) => (
          <section key={section.key} aria-labelledby={id(section.key)} className="space-y-3 py-5">
            <h3 id={id(section.key)} className="text-base font-semibold">
              {section.heading}
            </h3>
            {section.bullets.length > 0 && (
              <ul className="list-disc space-y-2 pl-5 text-[0.9375rem] leading-relaxed marker:text-muted-foreground">
                {section.bullets.map((bullet, i) => (
                  <li key={i} className="pl-1">
                    {bullet}
                  </li>
                ))}
              </ul>
            )}
            {section.key === "directions" && f.dosageTableHtml && (
              <div className="space-y-2 pt-1">
                <p className="text-sm text-muted-foreground">
                  Dosing table, shown in full exactly as printed. MedCheck doesn&apos;t pick a row.
                </p>
                <div
                  className="overflow-x-auto rounded-xl border bg-card text-sm shadow-xs [&_table]:w-full [&_table]:border-collapse [&_td]:border-t [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_th]:bg-surface [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold [&_tr:first-child_td]:border-t-0"
                  dangerouslySetInnerHTML={{ __html: f.dosageTableHtml }}
                />
              </div>
            )}
          </section>
        ))}
      </div>

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
        <Button
          variant="outline"
          nativeButton={false}
          render={<a href="tel:18002221222" />}
          className="h-11 w-full px-4 text-base sm:w-auto"
        >
          <PhoneIcon aria-hidden /> Poison Control 1-800-222-1222
        </Button>
      </footer>
    </article>
  );
}
