import "server-only";

// Barcode/NDC → formulation: our catalog first, then live openFDA. A live hit is saved into the
// catalog (secret-key client; the catalog is server-write) so the next scan is a catalog hit.
// Live rows have `reviewed_at` null — they were not hand-checked like the seeded ones.
import { findFormulationByNdc11, rowToFormulation } from "@/lib/catalog";
import type { Formulation } from "@/lib/domain/schema";
import { ndc11FromHyphenated, ndcLookupKeys } from "@/lib/ndc";
import { fetchLabelsByNdc, formulationToRow, labelToFormulation, type OpenFdaLabel } from "@/lib/openfda";
import { createAdminClient } from "@/lib/supabase/server";

/** A label's package NDCs in the catalog's 11-digit form. */
function labelNdc11s(label: OpenFdaLabel): string[] {
  return (label.openfda?.package_ndc ?? []).map(ndc11FromHyphenated).filter((n): n is string => n !== null);
}

/**
 * The formulation for a barcode or typed NDC; null when no label matches; "unavailable" when it
 * isn't in the catalog and openFDA didn't answer, so we can't say it isn't supported.
 */
export async function lookupFormulationByBarcode(text: string): Promise<Formulation | null | "unavailable"> {
  const keys = ndcLookupKeys(text);
  if (!keys) return null;

  const fromCatalog = await findFormulationByNdc11(keys.ndc11);
  if (fromCatalog) return fromCatalog;

  let labels;
  try {
    labels = await fetchLabelsByNdc(keys.hyphenated, keys.upc, 6000);
  } catch (error) {
    // openFDA unavailable → catalog only.
    console.warn("openFDA lookup failed", error);
    return "unavailable";
  }

  const matching = labels.filter(
    (label) =>
      labelNdc11s(label).some((n) => keys.ndc11.includes(n)) ||
      (keys.upc !== null && (label.openfda?.upc ?? []).includes(keys.upc)),
  );

  // A UPC can lead to a label whose own NDCs we already carry (Tylenol's UPC says 0045-…, its label
  // 50580-…): prefer that hand-checked catalog row to a live copy.
  const fromCatalogByLabel = await findFormulationByNdc11(matching.flatMap(labelNdc11s));
  if (fromCatalogByLabel) return fromCatalogByLabel;

  for (const label of matching) {
    const formulation = labelToFormulation(label);
    if (!formulation) continue;
    const { data, error } = await createAdminClient()
      .from("formulations")
      .upsert(formulationToRow(formulation, null), { onConflict: "slug" })
      .select("*")
      .single();
    if (error) throw error;
    return rowToFormulation(data);
  }
  return null;
}
