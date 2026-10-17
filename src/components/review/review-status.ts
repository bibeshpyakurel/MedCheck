// The review screen's groups, progress and status lines. Pure. It never says "everything has been
// checked": a value the user left unknown is a decision, not a verified value.
import type { EntryFields, Field } from "@/lib/domain/schema";

/** Where the values were read from: a label or document, or the user's own description. */
export type ReviewSource = "label" | "description";

/** The three decisions, worded for where the value came from. */
export const DECISION_LABELS: Record<ReviewSource, { matches: string; change: string; unknown: string }> = {
  label: { matches: "Matches the label", change: "Change it", unknown: "I can't read it" },
  description: { matches: "Matches what I said", change: "Change it", unknown: "Leave it unknown" },
};

export type ReviewGroupId = "medicine" | "ingredients" | "directions";

export const REVIEW_GROUPS: { id: ReviewGroupId; title: string }[] = [
  { id: "medicine", title: "Medicine name and form" },
  { id: "ingredients", title: "Ingredients and strengths" },
  { id: "directions", title: "Directions, written amount and maximum as printed" },
];

export function groupFields(fields: EntryFields, group: ReviewGroupId): Field<unknown>[] {
  switch (group) {
    case "medicine":
      return [fields.productName, fields.dosageForm];
    case "ingredients":
      return fields.ingredients.flatMap((i) => [i.name, i.strength] as Field<unknown>[]);
    case "directions":
      return [fields.instructions, fields.doseAsWritten, fields.max24h];
  }
}

function allFields(fields: EntryFields): Field<unknown>[] {
  return REVIEW_GROUPS.flatMap((g) => groupFields(fields, g.id));
}

/** Never suggested and nothing to point at (a catalog label with no written dose): not something the user couldn't tell. */
export const neverOnSource = (f: Field<unknown>) => f.aiValue === null && f.evidence.kind === "none";
const leftUnknown = (f: Field<unknown>) => f.state === "unknown" && !neverOnSource(f);

export type GroupProgress = { decided: number; total: number; pending: number };

export function groupProgress(fields: Field<unknown>[]): GroupProgress {
  const pending = fields.filter((f) => f.state === "pending").length;
  return { decided: fields.length - pending, total: fields.length, pending };
}

/** "1 of 2 checked", "All checked", or "None added yet" for an empty ingredient list. */
export function groupProgressLabel({ decided, total, pending }: GroupProgress): string {
  if (total === 0) return "None added yet";
  return pending === 0 ? "All checked" : `${decided} of ${total} checked`;
}

/** How many fields the user has acted on, for the progress bar. */
export function reviewProgress(fields: EntryFields): { reviewed: number; total: number } {
  const { decided, total } = groupProgress(allFields(fields));
  return { reviewed: decided, total };
}

/** "4 of 7 details checked · 1 left unknown". */
export function reviewStatusMessage(fields: EntryFields): string {
  const all = allFields(fields);
  const { decided, total } = groupProgress(all);
  const unknown = all.filter(leftUnknown).length;
  return `${decided} of ${total} details checked${unknown > 0 ? ` · ${unknown} left unknown` : ""}`;
}

/**
 * What confirming will save, once nothing is waiting: "5 match the label, 1 changed, 1 left unknown —
 * checks that need unknown details won't run." Null while any value still needs a decision.
 */
export function confirmationSummary(fields: EntryFields, source: ReviewSource): string | null {
  const all = allFields(fields);
  if (all.some((f) => f.state === "pending")) return null;
  const count = (test: (f: Field<unknown>) => boolean) => all.filter(test).length;
  const matched = count((f) => f.state === "confirmed");
  const changed = count((f) => f.state === "edited");
  const unknown = count(leftUnknown);
  const absent = count((f) => f.state === "unknown" && neverOnSource(f));
  const what = source === "label" ? "the label" : "what you said";
  const parts = [
    matched > 0 ? `${matched} ${matched === 1 ? "matches" : "match"} ${what}` : null,
    changed > 0 ? `${changed} changed` : null,
    unknown > 0 ? `${unknown} left unknown` : null,
    absent > 0 ? `${absent} not on ${source === "label" ? "the label" : "what you said"}` : null,
  ].filter((p): p is string => p !== null);
  const tail = unknown > 0 ? " — checks that need unknown details won't run." : ".";
  return `${parts.join(", ")}${tail}`;
}
