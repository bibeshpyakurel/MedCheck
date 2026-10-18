// The photo pop-up's decisions (spec: photo answers §2). Pure; safe on client and server.
// One photo → "Is this …?" for each medicine read → Continue (the user's confirmation of which
// product each one is) → the answer card or the comparison → Save to My medicines or Don't save.
import { OTHER_MATCHES, type MatchOption, type PhotoReadResult } from "@/lib/photo-flow";

/**
 * After a read: a medicine-package photo with something readable opens the pop-up (its next step
 * would be the confirm page, `/match`); nothing readable goes to `/retake`, other photos to `/review`.
 */
export function opensPhotoAnswers(result: PhotoReadResult): boolean {
  return result.kind === "otc_package" && new URL(result.next, "http://medcheck.local").pathname.endsWith("/match");
}

/** One medicine read from the photo, with its choices from the FDA list. */
export type PhotoMatchItem = {
  entryId: string;
  /** The product name Gemini read, to start "Type it in" with. */
  readName: string | null;
  selectedId: string | null;
  options: MatchOption[];
  /** Nothing readable, or nothing found: only "Type it in". */
  onlySearch: boolean;
};

/** What the user chose for one medicine: an FDA label, or (no match) the name they typed. */
export type PhotoPick = { entryId: string; formulationId: string } | { entryId: string; typedName: string };

export type MedicineChoice = { kind: "label"; option: MatchOption } | { kind: "typed"; name: string } | null;

export type ChoiceState = { entryId: string; choice: MedicineChoice; removed: boolean };

/** More medicines than this and the pop-up steps through them one at a time. */
const ROWS_AT_ONCE = 3;

/** One medicine: "Is this …?"; two or three: a row each; more: one at a time. */
export function confirmLayout(count: number): "one" | "rows" | "steps" {
  if (count <= 1) return "one";
  return count <= ROWS_AT_ONCE ? "rows" : "steps";
}

/** The pre-selected FDA label, or nothing chosen yet. */
export function initialChoice(item: PhotoMatchItem): MedicineChoice {
  const option = item.options.find((o) => o.id === item.selectedId);
  return option ? { kind: "label", option } : null;
}

/** "Not this one?": the matches other than the chosen one (shown above them already), up to 5. */
export function otherMatches(options: MatchOption[], chosenId: string | null): MatchOption[] {
  return options.filter((o) => o.id !== chosenId).slice(0, OTHER_MATCHES);
}

/**
 * What Continue confirms: one pick per medicine still in the photo, in photo order. Null while any of
 * them has no choice (or only a blank typed name), and when every medicine was removed.
 */
export function picksFrom(states: ChoiceState[]): PhotoPick[] | null {
  const picks: PhotoPick[] = [];
  for (const { entryId, choice, removed } of states) {
    if (removed) continue;
    if (choice?.kind === "label") picks.push({ entryId, formulationId: choice.option.id });
    else if (choice?.kind === "typed" && choice.name.trim()) picks.push({ entryId, typedName: choice.name.trim() });
    else return null;
  }
  return picks.length > 0 ? picks : null;
}
