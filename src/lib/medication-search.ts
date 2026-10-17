// Client-safe helpers for the record page's medicine list. Pure.
import { entryLabel } from "@/lib/domain/fields";
import type { MedicationEntry, SourceDocument } from "@/lib/domain/schema";

/** Case-insensitive match on product, ingredients, and the source document's facility/prescriber/pharmacy. */
export function matchesQuery(entry: MedicationEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const doc = entry.sourceDocument;
  const haystack = [
    entryLabel(entry.fields),
    ...entry.fields.ingredients.map((i) => i.name.value ?? i.name.aiValue ?? ""),
    doc?.facility,
    doc?.prescriber,
    doc?.pharmacy,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  return haystack.includes(q);
}

export type SourceGroup = { key: string; document: SourceDocument | null; entries: MedicationEntry[] };

/** Groups entries by their source document, keeping first-seen order; entries without one go last. */
export function groupBySource(entries: MedicationEntry[]): SourceGroup[] {
  const groups = new Map<string, SourceGroup>();
  for (const e of entries) {
    const key = e.sourceDocument?.id ?? "none";
    const group = groups.get(key) ?? { key, document: e.sourceDocument, entries: [] };
    group.entries.push(e);
    groups.set(key, group);
  }
  const list = [...groups.values()];
  return [...list.filter((g) => g.document), ...list.filter((g) => !g.document)];
}
