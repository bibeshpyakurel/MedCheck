// The review screen's status line. Pure. It never says "everything has been checked": going through
// every field isn't the same as every value being known.
import type { EntryFields, Field } from "@/lib/domain/schema";

function allFields(fields: EntryFields): Field<unknown>[] {
  return [
    fields.productName,
    fields.dosageForm,
    fields.instructions,
    fields.doseAsWritten,
    fields.max24h,
    ...fields.ingredients.flatMap((i) => [i.name, i.strength] as Field<unknown>[]),
  ];
}

/** Never suggested and nothing to point at (a catalog label with no written dose): not something the user couldn't tell. */
const neverOnSource = (f: Field<unknown>) => f.aiValue === null && f.evidence.kind === "none";

export function reviewStatusMessage(fields: EntryFields): string {
  const all = allFields(fields);
  const pending = all.filter((f) => f.state === "pending").length;
  if (pending > 0) return `${pending} ${pending === 1 ? "value needs" : "values need"} Matches, Edit or Can't tell.`;
  const unknown = all.filter((f) => f.state === "unknown" && !neverOnSource(f)).length;
  if (unknown === 0) return "You've gone through every field.";
  return `You've gone through every field. ${unknown} you couldn't tell — checks that need ${unknown === 1 ? "it" : "them"} will stay unresolved.`;
}
