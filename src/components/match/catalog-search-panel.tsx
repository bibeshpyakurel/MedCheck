"use client";

import { LoaderCircleIcon, SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptionCard } from "./option-card";
import type { useCatalogSearch } from "./use-catalog-search";

/** "Type it in": the medicine-name box, the search status, and the FDA labels found as radio cards. */
export function CatalogSearchPanel({
  search,
  selectedId,
  onSelect,
  inputId,
  name = "medicine",
}: {
  search: ReturnType<typeof useCatalogSearch>;
  selectedId: string | null;
  /** null when the query changes: a result from the old query is no longer chosen. */
  onSelect: (id: string | null) => void;
  inputId: string;
  name?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={inputId} className="text-base font-semibold">
          Medicine name
        </Label>
        <div className="relative">
          <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={inputId}
            type="search"
            autoComplete="off"
            enterKeyHint="search"
            value={search.query}
            onChange={(e) => {
              onSelect(null);
              search.change(e.target.value);
            }}
            placeholder="e.g. Tylenol Extra Strength"
            className="h-12 pl-11 text-base md:text-base"
          />
        </div>
      </div>
      <p role="status" className="min-h-5 text-sm text-muted-foreground">
        {search.status === "searching" ? (
          <span className="inline-flex items-center gap-2">
            <LoaderCircleIcon aria-hidden className="size-4 animate-spin" /> Searching…
          </span>
        ) : search.status === "error" ? (
          "Search isn't working right now. Try again in a moment."
        ) : search.status === "done" && search.results.length === 0 ? (
          `No medicines found for “${search.searched}”.`
        ) : null}
      </p>
      {search.results.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="sr-only">Search results from the FDA list</legend>
          {search.results.map((o) => (
            <OptionCard key={o.id} option={o} name={name} checked={selectedId === o.id} onSelect={onSelect} />
          ))}
        </fieldset>
      )}
    </div>
  );
}
