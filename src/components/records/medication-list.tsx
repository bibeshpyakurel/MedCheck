"use client";

import { ChevronRightIcon, DatabaseIcon, FileTextIcon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, ViewTransition } from "react";
import { IngredientChip } from "@/components/ingredient-chip";
import { Input } from "@/components/ui/input";
import { entryLabel, formatStrength } from "@/lib/domain/fields";
import type { MedicationEntry, SourceDocument } from "@/lib/domain/schema";
import { groupBySource, matchesQuery } from "@/lib/medication-search";
import { DOCUMENT_KIND_LABELS, entryTitleTransition, formatDocDate } from "@/lib/record-format";

/**
 * Confirmed medicines grouped by the document they came from, with a client-side search. `overlapping`
 * holds the normalized names of ingredients the warnings say are shared; their chips are amber.
 */
export function MedicationList({
  patientId,
  entries,
  overlapping = [],
}: {
  patientId: string;
  entries: MedicationEntry[];
  overlapping?: string[];
}) {
  const [query, setQuery] = useState("");
  const shared = useMemo(() => new Set(overlapping), [overlapping]);
  const visible = entries.filter((e) => matchesQuery(e, query));
  const groups = groupBySource(visible);

  return (
    <div className="space-y-4">
      {entries.length > 1 ? (
        <div className="relative">
          <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by medicine or ingredient"
            aria-label="Search medicines"
            className="h-11 pr-10 pl-10 text-base"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted"
            >
              <XIcon aria-hidden className="size-4" />
            </button>
          ) : null}
        </div>
      ) : null}

      {query && visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-card/50 p-8 text-center text-sm text-muted-foreground">
          No medicines match &ldquo;{query}&rdquo;.
        </p>
      ) : null}
      {query && visible.length > 0 ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {visible.length} of {entries.length} medicines
        </p>
      ) : null}

      {groups.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
          {groups.map((g) => (
            <section key={g.key} className="border-t first:border-t-0">
              <SourceHeader document={g.document} />
              <ul className="divide-y">
                {g.entries.map((e) => (
                  <li key={e.id}>
                    <MedicineRow patientId={patientId} entry={e} shared={shared} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Which document a group of medicines came from. Facility, pharmacy and prescriber are in each medicine's record. */
function SourceHeader({ document }: { document: SourceDocument | null }) {
  const date = formatDocDate(document?.documentDate ?? null);
  return (
    <h3 className="flex items-center gap-2 border-b bg-surface px-4 py-2 text-sm font-medium text-muted-foreground">
      {document ? <FileTextIcon aria-hidden className="size-3.5" /> : <DatabaseIcon aria-hidden className="size-3.5" />}
      {document ? DOCUMENT_KIND_LABELS[document.kind] : "Label in the MedCheck catalog"}
      {date ? <span className="font-normal"> · {date}</span> : null}
    </h3>
  );
}

function MedicineRow({ patientId, entry, shared }: { patientId: string; entry: MedicationEntry; shared: ReadonlySet<string> }) {
  const f = entry.fields;
  const fromDescription = entry.sourceDocument?.kind === "description" || entry.inputMethod === "voice" || entry.inputMethod === "typed";
  return (
    // Prefetched in full so the medicine's page is ready in the same commit and its title can morph
    // from this one (a dynamic route otherwise stops at the loading skeleton). Production only.
    <Link
      href={`/patients/${patientId}/entries/${entry.id}`}
      prefetch
      className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1">
        <ViewTransition name={entryTitleTransition(entry.id)} share="morph" default="none">
          <p className="w-fit font-semibold text-pretty">{entryLabel(f)}</p>
        </ViewTransition>
        {f.ingredients.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {f.ingredients.map((i, idx) => (
              <li key={idx} className="max-w-full">
                {i.name.value ? (
                  <IngredientChip name={i.name.value} strength={i.strength.value ? formatStrength(i.strength.value) : null} overlapping={shared} />
                ) : (
                  <span className="text-sm text-muted-foreground">Ingredient unknown</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Ingredients unknown</p>
        )}
        {fromDescription ? <p className="mt-1 text-sm text-muted-foreground">From your description, not a label</p> : null}
        <p className="mt-2 text-sm font-medium text-primary">Details and label</p>
      </div>
      <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
