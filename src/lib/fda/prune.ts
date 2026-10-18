// Which previously imported catalog rows a re-import should delete. Pure.

export type CatalogRowRef = { id: string; slug: string; source: string; reviewed_at: string | null };

/**
 * Imported rows (source 'openfda', not hand-checked, slug otc-…) that the current run didn't produce.
 * Rows a saved medication entry points at are kept and reported instead.
 */
export function planPrune(
  existing: CatalogRowRef[],
  produced: Set<string>,
  referencedIds: Set<string>,
): { remove: CatalogRowRef[]; keptReferenced: CatalogRowRef[] } {
  const stale = existing.filter((r) => r.source === "openfda" && r.reviewed_at === null && r.slug.startsWith("otc-") && !produced.has(r.slug));
  return {
    remove: stale.filter((r) => !referencedIds.has(r.id)),
    keptReferenced: stale.filter((r) => referencedIds.has(r.id)),
  };
}
