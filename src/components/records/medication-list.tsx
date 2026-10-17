"use client";

import { ChevronRightIcon, FileTextIcon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { entryLabel, formatStrength } from "@/lib/domain/fields";
import type { MedicationEntry, SourceDocument } from "@/lib/domain/schema";
import { groupBySource, matchesQuery } from "@/lib/medication-search";
import { DOCUMENT_KIND_LABELS, formatDocDate, INPUT_METHOD_LABELS } from "@/lib/record-format";

/** Confirmed medicines grouped by the document they came from, with a client-side search. */
export function MedicationList({ patientId, entries }: { patientId: string; entries: MedicationEntry[] }) {
  const [query, setQuery] = useState("");
  const visible = entries.filter((e) => matchesQuery(e, query));
  const groups = groupBySource(visible);

  return (
    <div className="space-y-4">
      {entries.length > 1 ? (
        <div className="relative">
          <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search medicines, ingredients, pharmacy…"
            aria-label="Search medicines"
            className="h-11 pr-10 pl-9 text-base"
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
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No medicines match &ldquo;{query}&rdquo;.
        </p>
      ) : null}
      {query && visible.length > 0 ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {visible.length} of {entries.length} medicines
        </p>
      ) : null}

      {groups.map((g) => (
        <section key={g.key} className="overflow-hidden rounded-xl border bg-card">
          <SourceHeader document={g.document} />
          <ul className="divide-y">
            {g.entries.map((e) => (
              <li key={e.id}>
                <MedicineRow patientId={patientId} entry={e} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SourceHeader({ document }: { document: SourceDocument | null }) {
  const details = document
    ? [document.facility, document.pharmacy, document.prescriber && `Prescriber: ${document.prescriber}`].filter(Boolean)
    : [];
  const date = formatDocDate(document?.documentDate ?? null);
  return (
    <header className="flex items-start gap-3 border-b bg-muted/50 px-4 py-3">
      <FileTextIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 text-sm">
        <p className="font-medium">
          {document ? DOCUMENT_KIND_LABELS[document.kind] : "Label in the MedCheck catalog"}
          {date ? <span className="font-normal text-muted-foreground"> · {date}</span> : null}
        </p>
        {details.length > 0 ? <p className="mt-0.5 text-muted-foreground">{details.join(" · ")}</p> : null}
      </div>
    </header>
  );
}

function MedicineRow({ patientId, entry }: { patientId: string; entry: MedicationEntry }) {
  const f = entry.fields;
  const form = f.dosageForm.value;
  const fromDescription = entry.sourceDocument?.kind === "description" || entry.inputMethod === "voice" || entry.inputMethod === "typed";
  return (
    <Link
      href={`/patients/${patientId}/entries/${entry.id}`}
      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-pretty">{entryLabel(f)}</p>
        {f.ingredients.length > 0 ? (
          <ul className="mt-1 space-y-0.5 text-sm">
            {f.ingredients.map((i, idx) => (
              <li key={idx}>
                <span>{i.name.value ?? "Ingredient unknown"}</span>{" "}
                <span className="text-muted-foreground">
                  {i.strength.value ? formatStrength(i.strength.value) : "· strength unknown"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Ingredients unknown</p>
        )}
        <p className="mt-1.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
          {form ? <span className="capitalize">{form}</span> : null}
          {form ? <span aria-hidden>·</span> : null}
          <span>{INPUT_METHOD_LABELS[entry.inputMethod]}</span>
          {fromDescription ? (
            <>
              <span aria-hidden>·</span>
              <span>From your description, not a label</span>
            </>
          ) : null}
        </p>
      </div>
      <span className="hidden text-sm text-primary sm:inline">View label</span>
      <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}
