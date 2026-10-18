// Whether the per-field review has changes that leaving would throw away. Pure; client-safe.
import type { DocumentDetails } from "@/lib/ai/extract-label";
import type { EntryFields } from "@/lib/domain/schema";

type ReviewState = { fields: EntryFields; document: DocumentDetails | null };

/** True once anything differs from what the page loaded with: a decision, an edit, a row, a document detail. */
export function hasUnsavedChanges(initial: ReviewState, current: ReviewState): boolean {
  return JSON.stringify(initial) !== JSON.stringify(current);
}
