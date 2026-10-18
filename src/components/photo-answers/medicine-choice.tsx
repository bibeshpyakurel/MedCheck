"use client";

import { CheckIcon, ChevronDownIcon, Undo2Icon } from "lucide-react";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { CatalogSearchPanel } from "@/components/match/catalog-search-panel";
import { OptionCard, OptionDetails } from "@/components/match/option-card";
import { useCatalogSearch } from "@/components/match/use-catalog-search";
import { Button } from "@/components/ui/button";
import { otherMatches, type ChoiceState, type MedicineChoice as Choice, type PhotoMatchItem } from "@/lib/photo-answers";
import { cn } from "@/lib/utils";

/** "Is this Tylenol Extra Strength?" with the brand in bold; or the question when nothing is chosen. */
export function choiceQuestion(item: PhotoMatchItem, choice: Choice) {
  if (choice?.kind === "label") {
    return (
      <>
        Is this <strong className="font-semibold">{choice.option.brandName}</strong>?
      </>
    );
  }
  if (choice?.kind === "typed") return <>Save it by the name you typed?</>;
  return item.onlySearch ? <>Type in the name on the package</> : <>Which medicine is this?</>;
}

/**
 * One medicine from the photo: its best FDA match ("Is this …?"), **Not this one?** with up to 5 other
 * distinct products, **None of these — type it in** (catalog search, or the typed name as a last
 * resort) and, when the photo shows several, **Remove from this photo**. Nothing is saved here; the
 * choice goes up through `onChange`.
 */
export function MedicineChoice({
  item,
  state,
  onChange,
  position,
  disabled,
}: {
  item: PhotoMatchItem;
  state: ChoiceState;
  onChange: (next: Pick<ChoiceState, "choice" | "removed">) => void;
  /** "1 of 2" when the photo shows several medicines (then the row has its own question and Remove). */
  position: { n: number; total: number } | null;
  disabled: boolean;
}) {
  const { choice, removed } = state;
  const [mode, setMode] = useState<"pick" | "search">(item.onlySearch ? "search" : "pick");
  const [showOthers, setShowOthers] = useState(item.selectedId === null);
  // The match chosen before "Type it in", restored by "Back to the matches".
  const beforeSearch = useRef<Choice>(null);
  const search = useCatalogSearch(item.readName ?? "");
  const id = useId();
  const group = `medicine-${item.entryId}`;

  const searchOnOpen = useEffectEvent(() => search.run(search.query));
  useEffect(() => {
    if (mode === "search") queueMicrotask(searchOnOpen);
  }, [mode]);

  const choose = (next: Choice) => onChange({ choice: next, removed: false });

  function openSearch() {
    beforeSearch.current = choice;
    choose(null);
    setMode("search");
  }

  function backToMatches() {
    choose(beforeSearch.current);
    setMode("pick");
  }

  const label = position ? `${position.n} of ${position.total}` : null;

  if (removed) {
    return (
      <section aria-label={`Medicine ${label}, removed`} className="flex items-center gap-3 rounded-2xl border border-dashed bg-surface p-4">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground nums">{label}</span> · {item.readName ?? "A medicine"} — removed from this photo.
        </p>
        <Button type="button" variant="outline" className="h-11 px-4" disabled={disabled} onClick={() => onChange({ choice, removed: false })}>
          <Undo2Icon aria-hidden /> Undo
        </Button>
      </section>
    );
  }

  const chosenId = choice?.kind === "label" ? choice.option.id : null;
  // The chosen one is shown above; "Not this one?" lists the rest.
  const others = otherMatches(item.options, chosenId);
  const typed = search.query.trim();

  return (
    <section aria-labelledby={position ? `${id}-q` : undefined} className={cn("space-y-4", position && "rounded-2xl border bg-card p-4 shadow-xs")}>
      {position && (
        <header className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground nums">{label}</p>
          <h3 id={`${id}-q`} className="text-lg font-semibold text-pretty">
            {choiceQuestion(item, choice)}
          </h3>
        </header>
      )}

      {mode === "pick" && choice?.kind === "label" && (
        <div className="flex items-start gap-3 rounded-xl border border-primary bg-accent p-4 ring-1 ring-primary/30">
          <CheckIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
          <OptionDetails option={choice.option} />
        </div>
      )}

      {mode === "pick" ? (
        <div className="space-y-2">
          {item.options.length > 0 && (chosenId === null ? (
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">Pick the one that matches the package.</legend>
              {item.options.map((o) => (
                <OptionCard key={o.id} option={o} name={group} checked={false} onSelect={() => choose({ kind: "label", option: o })} />
              ))}
            </fieldset>
          ) : (
            others.length > 0 && (
              <>
                <button
                  type="button"
                  aria-expanded={showOthers}
                  aria-controls={`${id}-others`}
                  onClick={() => setShowOthers((v) => !v)}
                  className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  Not this one?
                  <ChevronDownIcon aria-hidden className={cn("size-4 transition-transform", showOthers && "rotate-180")} />
                </button>
                <fieldset id={`${id}-others`} hidden={!showOthers} className="space-y-2">
                  <legend className="sr-only">Other matches from the FDA list</legend>
                  {others.map((o) => (
                    <OptionCard key={o.id} option={o} name={group} checked={false} onSelect={() => choose({ kind: "label", option: o })} />
                  ))}
                </fieldset>
              </>
            )
          ))}
          <Button type="button" variant="outline" className="h-11 w-full px-4 text-base" disabled={disabled} onClick={openSearch}>
            None of these — type it in
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <CatalogSearchPanel
            search={search}
            inputId={`${id}-name`}
            name={group}
            selectedId={chosenId}
            onSelect={(found) => {
              const option = search.results.find((o) => o.id === found);
              choose(option ? { kind: "label", option } : null);
            }}
          />
          <div className="space-y-2 rounded-xl border bg-surface p-4">
            <p className="text-sm text-muted-foreground text-pretty">
              Can&apos;t find it? Save the name you typed. Its strength and other details stay unknown, so checks that need them
              can&apos;t run.
            </p>
            <Button
              type="button"
              variant={choice?.kind === "typed" ? "default" : "outline"}
              aria-pressed={choice?.kind === "typed"}
              className="h-11 w-full px-4 text-base sm:w-auto"
              disabled={disabled || !typed}
              onClick={() => choose({ kind: "typed", name: typed })}
            >
              {choice?.kind === "typed" && <CheckIcon aria-hidden />}
              Use the name I typed
            </Button>
          </div>
          {!item.onlySearch && (
            <Button type="button" variant="ghost" className="h-11 w-full px-4 text-base" disabled={disabled} onClick={backToMatches}>
              Back to the matches
            </Button>
          )}
        </div>
      )}

      {position && (
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-full px-4 text-base text-muted-foreground"
          disabled={disabled}
          onClick={() => onChange({ choice, removed: true })}
        >
          Remove from this photo
        </Button>
      )}
    </section>
  );
}
