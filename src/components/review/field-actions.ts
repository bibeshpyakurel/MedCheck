// Pure state transitions for one reviewed field: Matches / Edit / Can't tell.
import type { Field } from "@/lib/domain/schema";

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return (
    ka.length === kb.length &&
    ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  );
}

/** "Matches": the shown value is what the label says. */
export function markMatches<T>(field: Field<T>): Field<T> {
  if (field.value === null) return { ...field, state: "unknown" };
  return { ...field, state: deepEqual(field.value, field.aiValue) ? "confirmed" : "edited" };
}

/** "Edit": the user typed the value. Empty → unknown; same as the suggestion → confirmed. */
export function applyEdit<T>(field: Field<T>, value: T | null): Field<T> {
  if (value === null) return { ...field, value: null, state: "unknown" };
  return { ...field, value, state: deepEqual(value, field.aiValue) ? "confirmed" : "edited" };
}

/** "Can't tell": no value; checks that need it stay unresolved. */
export function markUnknown<T>(field: Field<T>): Field<T> {
  return { ...field, value: null, state: "unknown" };
}
