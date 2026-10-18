// Original FDA label: every Drug Facts section in label order, as published, with the full dosing table and the source.
import { DosingTable, LabelBullets, SourceLinks } from "@/components/medicine-card/label-parts";
import type { Formulation } from "@/lib/domain/schema";
import { cardSections } from "@/lib/medicine-card";
import { formatDocDate } from "@/lib/record-format";

const NDCS_SHOWN = 3;

/** A label can list dozens of package NDCs: the first few, the rest one tap away. */
function NdcList({ ndcs }: { ndcs: string[] }) {
  const first = ndcs.slice(0, NDCS_SHOWN).join(", ");
  if (ndcs.length <= NDCS_SHOWN) return <span className="break-all">{first}</span>;
  return (
    <details className="group">
      <summary className="inline-flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-2 [&::-webkit-details-marker]:hidden">
        <span className="break-all">{first}</span>
        <span className="font-sans font-medium text-primary group-open:hidden">Show all {ndcs.length}</span>
      </summary>
      <p className="break-all">{ndcs.slice(NDCS_SHOWN).join(", ")}</p>
    </details>
  );
}

export function OriginalLabel({ formulation: f }: { formulation: Formulation }) {
  const sections = cardSections(f);
  const id = (key: string) => `orig-${f.id}-${key}`;
  const date = formatDocDate(f.labelEffectiveDate);
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Every Drug Facts section as published, in label order. Nothing is reworded.</p>
      {sections.length > 0 && (
        <div className="divide-y rounded-2xl border bg-card px-4 shadow-xs sm:px-5">
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
      )}
      <section aria-labelledby={id("meta")} className="space-y-2 rounded-2xl border bg-card p-4 text-sm shadow-xs">
        <h3 id={id("meta")} className="font-semibold">
          Source
        </h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          {f.openfdaSetId && (
            <>
              <dt className="text-muted-foreground">openFDA set ID</dt>
              <dd className="font-mono text-xs break-all">{f.openfdaSetId}</dd>
            </>
          )}
          {f.ndcPackages.length > 0 && (
            <>
              <dt className="text-muted-foreground">NDC</dt>
              <dd className="font-mono text-xs">
                <NdcList ndcs={f.ndcPackages} />
              </dd>
            </>
          )}
          {date && (
            <>
              <dt className="text-muted-foreground">Effective</dt>
              <dd>{date}</dd>
            </>
          )}
          {f.labelerName && (
            <>
              <dt className="text-muted-foreground">Labeler</dt>
              <dd>{f.labelerName}</dd>
            </>
          )}
        </dl>
        <SourceLinks links={f.sourceLinks} />
      </section>
    </div>
  );
}
