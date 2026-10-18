"use client";

import { ChevronDownIcon, LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useId, useState, useTransition } from "react";
import { BackLink, goBackTo } from "@/components/back-link";
import { CatalogSearchPanel } from "@/components/match/catalog-search-panel";
import { OptionCard } from "@/components/match/option-card";
import { useCatalogSearch } from "@/components/match/use-catalog-search";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { MatchOption } from "@/lib/photo-flow";
import { cn } from "@/lib/utils";

type ActionResult = Promise<{ error: string; gone?: true } | void>;

/**
 * "Is this the medicine?": the pre-selected FDA label (if any) with the other matches below, or
 * "Type it in" — a catalog search with the same picker, and saving the typed name as a last resort.
 * "Type it in" has its own URL (`?search=1`), so browser Back returns to the matches; with no matches
 * to show (`onlySearch`) it is the whole page. Nothing is saved until the user taps Confirm (or Save
 * without a match).
 */
export function MatchPicker({
  patientId,
  entryId,
  options,
  selectedId,
  onlySearch,
  readName,
  photoUrl,
  othersFromPhoto,
  confirmAction,
  saveTypedAction,
}: {
  patientId: string;
  entryId: string;
  options: MatchOption[];
  selectedId: string | null;
  /** No matches to pick from (or nothing readable): only "Type it in". */
  onlySearch: boolean;
  /** The product name Gemini read, to start the search with. */
  readName: string | null;
  photoUrl: string | null;
  othersFromPhoto: number;
  confirmAction: (input: { patientId: string; entryId: string; formulationId: string }) => ActionResult;
  saveTypedAction: (input: { patientId: string; entryId: string; name: string }) => ActionResult;
}) {
  const pathname = usePathname();
  const searchParam = useSearchParams().get("search");
  const mode: "pick" | "search" = onlySearch || searchParam === "1" ? "search" : "pick";
  // Each mode keeps its own choice, so going back to the matches finds the pre-selected one again.
  const [picked, setPicked] = useState<string | null>(selectedId);
  const [found, setFound] = useState<string | null>(null);
  const selected = mode === "pick" ? picked : found;
  const setSelected = mode === "pick" ? setPicked : setFound;
  const [error, setError] = useState<{ message: string; gone: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const [showOthers, setShowOthers] = useState(selectedId === null);
  const othersId = useId();

  const search = useCatalogSearch(readName ?? "");

  function run(action: () => ActionResult) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError({ message: result.error, gone: result.gone === true });
    });
  }

  function confirm() {
    if (selected) run(() => confirmAction({ patientId, entryId, formulationId: selected }));
  }

  function openSearch() {
    setFound(null);
    setError(null);
    window.history.pushState(null, "", `${pathname}?search=1`);
  }

  function backToMatches() {
    setError(null);
    if (!goBackTo(pathname)) window.history.replaceState(null, "", pathname);
  }

  // Each time "Type it in" opens (including on arrival), search for what's in the box: at first, what Gemini read.
  const searchOnOpen = useEffectEvent(() => search.run(search.query));
  useEffect(() => {
    if (mode === "search") queueMicrotask(searchOnOpen);
  }, [mode]);

  const [first, ...rest] = options;
  const preselected = mode === "pick" && selectedId !== null && first?.id === selectedId;

  return (
    <div className="space-y-6">
      {mode === "search" && !onlySearch && <BackLink href={pathname}>Matches</BackLink>}
      <header className="flex items-start gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {mode === "pick" ? "Is this the medicine?" : "Type it in"}
          </h1>
          <p className="leading-relaxed text-muted-foreground text-pretty">
            {mode === "pick"
              ? options.length > 0
                ? "MedCheck looked up your photo in the FDA list. Check the name and strength against the package."
                : "MedCheck couldn't find this medicine in the FDA list."
              : "Type the name on the package. MedCheck searches the FDA list."}
          </p>
        </div>
        {photoUrl && (
          // Signed, short-lived Supabase URL; next/image would need the host configured.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="Your photo" className="size-20 shrink-0 rounded-xl border bg-surface object-cover shadow-xs sm:size-24" />
        )}
      </header>

      {mode === "pick" ? (
        <fieldset className="space-y-3">
          <legend className="sr-only">Matches from the FDA list</legend>
          {preselected ? (
            <>
              <OptionCard option={first} checked={selected === first.id} onSelect={setSelected} />
              {rest.length > 0 && (
                <div className="space-y-2">
                  <button
                    type="button"
                    aria-expanded={showOthers}
                    aria-controls={othersId}
                    onClick={() => setShowOthers((v) => !v)}
                    className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    Not this one? Other matches ({rest.length})
                    <ChevronDownIcon aria-hidden className={cn("size-4 transition-transform", showOthers && "rotate-180")} />
                  </button>
                  <div id={othersId} hidden={!showOthers} className="space-y-2">
                    {rest.map((o) => (
                      <OptionCard key={o.id} option={o} checked={selected === o.id} onSelect={setSelected} />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            options.length > 0 && (
              <>
                <p className="text-sm font-medium">Pick the one that matches the package.</p>
                <div className="space-y-2">
                  {options.map((o) => (
                    <OptionCard key={o.id} option={o} checked={selected === o.id} onSelect={setSelected} />
                  ))}
                </div>
              </>
            )
          )}
        </fieldset>
      ) : (
        <CatalogSearchPanel search={search} selectedId={selected} onSelect={setSelected} inputId="medicine-name" />
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="space-y-3">
            <p>{error.message}</p>
            {error.gone && (
              <Button variant="outline" className="h-11 px-4" nativeButton={false} render={<Link href={`/patients/${patientId}`} />}>
                Go to My medicines
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <Button type="button" size="lg" className="h-12 w-full text-base" disabled={!selected || pending} onClick={confirm}>
          {pending ? (
            <>
              <LoaderCircleIcon aria-hidden className="animate-spin" /> Saving…
            </>
          ) : (
            "Confirm"
          )}
        </Button>
        {mode === "pick" ? (
          <Button type="button" variant="outline" size="lg" className="h-12 w-full text-base" disabled={pending} onClick={openSearch}>
            None of these — type it in
          </Button>
        ) : (
          !onlySearch && (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="h-12 w-full text-base"
              disabled={pending}
              onClick={backToMatches}
            >
              Back to the matches
            </Button>
          )
        )}
        {othersFromPhoto > 0 && (
          <p className="text-sm text-muted-foreground">
            {othersFromPhoto} more {othersFromPhoto === 1 ? "medicine" : "medicines"} from this photo{" "}
            {othersFromPhoto === 1 ? "is" : "are"} waiting for review on the Medicines page.
          </p>
        )}
      </div>

      {mode === "search" && (
        <section aria-labelledby="no-match" className="space-y-3 rounded-2xl border bg-surface p-4">
          <h2 id="no-match" className="font-semibold">
            Can&apos;t find it?
          </h2>
          <p className="text-sm text-muted-foreground text-pretty">
            Save the name you typed. Its strength and other details stay unknown, so checks that need them can&apos;t run.
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full px-4 text-base sm:w-auto"
            disabled={pending || !search.query.trim()}
            onClick={() => run(() => saveTypedAction({ patientId, entryId, name: search.query }))}
          >
            Save without a match
          </Button>
        </section>
      )}
    </div>
  );
}
