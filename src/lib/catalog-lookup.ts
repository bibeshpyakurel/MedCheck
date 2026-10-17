import "server-only";

// Barcode/NDC → formulation: our catalog first, then live openFDA. A live hit is saved into the
// catalog (secret-key client; the catalog is server-write) so the next scan is a catalog hit.
// Live rows have `reviewed_at` null — they were not hand-checked like the seeded ones.
import { findFormulationByNdc11, rowToFormulation } from "@/lib/catalog";
import type { Formulation } from "@/lib/domain/schema";
import { ndc11Candidates, ndcHyphenatedCandidates, parseBarcode } from "@/lib/ndc";
import { fetchLabelsByNdc, formulationToRow, labelToFormulation } from "@/lib/openfda";
import { createAdminClient } from "@/lib/supabase/server";

export async function lookupFormulationByBarcode(text: string): Promise<Formulation | null> {
  const ndc10 = parseBarcode(text);
  if (!ndc10) return null;

  const candidates = ndc11Candidates(ndc10);
  const fromCatalog = await findFormulationByNdc11(candidates);
  if (fromCatalog) return fromCatalog;

  let labels;
  try {
    labels = await fetchLabelsByNdc(ndcHyphenatedCandidates(ndc10), 6000);
  } catch (error) {
    // openFDA unavailable → catalog only.
    console.warn("openFDA lookup failed", error);
    return null;
  }

  for (const label of labels) {
    const formulation = labelToFormulation(label);
    if (!formulation || !formulation.ndcPackages.some((n) => candidates.includes(n))) continue;
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
