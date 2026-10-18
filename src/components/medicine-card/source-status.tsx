// Source and status: where the label came from and whether anyone checked it by hand.
import { SourceLinks } from "@/components/medicine-card/label-parts";
import { type MedicationFacts, STATUS_TEXT } from "@/lib/medication-facts";
import { formatDocDate } from "@/lib/record-format";

export function SourceStatus({ facts, id }: { facts: MedicationFacts; id: string }) {
  const { source, header } = facts;
  const date = formatDocDate(header.labelDate);
  return (
    <section aria-labelledby={id} className="space-y-3 rounded-2xl border bg-card p-4 shadow-xs">
      <h3 id={id} className="font-semibold">
        Source and status
      </h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Source</dt>
        <dd>{source.kind === "fictional" ? "Fictional demo label" : "FDA label via openFDA"}</dd>
        {source.setId && (
          <>
            <dt className="text-muted-foreground">Set ID</dt>
            <dd className="font-mono text-xs break-all">{source.setId}</dd>
          </>
        )}
        {date && (
          <>
            <dt className="text-muted-foreground">Label date</dt>
            <dd>{date}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Status</dt>
        <dd>{STATUS_TEXT[header.status]}</dd>
      </dl>
      <SourceLinks links={source.links} />
    </section>
  );
}
