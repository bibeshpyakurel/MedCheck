import "server-only";

// The catalog label an NDC or barcode printed on a package points to. Gemini copies the codes off
// the photo; this looks them up exactly: our catalog first, then — for a UPC our catalog doesn't
// know — openFDA's NDC Directory, and back to the catalog with the package NDCs it lists. A code
// that leads to more than one label is no answer: we never guess between products.
import { findFormulationsByNdc11 } from "@/lib/catalog";
import type { Formulation } from "@/lib/domain/schema";
import { ndcLookupKeys } from "@/lib/ndc";
import { packageNdcsForUpc } from "@/lib/openfda";

/** The one label in `found`, or null when there are none or several. */
function onlyLabel(found: Formulation[]): Formulation | null {
  return new Set(found.map((f) => f.id)).size === 1 ? found[0] : null;
}

export async function findFormulationByCodes(codes: string[]): Promise<Formulation | null> {
  const keys = codes.map(ndcLookupKeys).filter((k) => k !== null);
  if (keys.length === 0) return null;

  const found = await findFormulationsByNdc11([...new Set(keys.flatMap((k) => k.ndc11))]);
  if (found.length > 0) return onlyLabel(found);

  for (const upc of new Set(keys.flatMap((k) => (k.upc ? [k.upc] : [])))) {
    const packages = await packageNdcsForUpc(upc).catch((error) => {
      console.warn("openFDA UPC lookup failed", error instanceof Error ? error.message : error);
      return [];
    });
    const viaFda = await findFormulationsByNdc11(packages);
    if (viaFda.length > 0) return onlyLabel(viaFda);
  }
  return null;
}
