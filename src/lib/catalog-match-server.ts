import "server-only";

import { isReadable, rankCatalogMatches, searchTermsFor, type CatalogMatch, type PhotoRead } from "@/lib/catalog-match";
import { searchFormulations } from "@/lib/catalog";
import { withoutFictional } from "@/lib/photo-flow";

const PER_TERM = 20;

/**
 * Search by each term, merge, rank; top `limit` (default 40: enough rows for `matchChoices` to find
 * 6 distinct products among store-brand copies). Empty when the read isn't readable.
 */
export async function findCatalogMatches(read: PhotoRead, limit = 40): Promise<CatalogMatch[]> {
  if (!isReadable(read)) return [];
  // Generic ingredient terms match thousands of rows, so ask for more than the default per term.
  const results = await Promise.all(searchTermsFor(read).map((term) => searchFormulations(term, PER_TERM)));
  return rankCatalogMatches(read, withoutFictional(results.flat())).slice(0, limit);
}
