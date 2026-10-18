import "server-only";

import { catalogIngredientSchema, labelSectionsSchema, sourceLinkSchema, type Formulation } from "@/lib/domain/schema";
import { sanitizeDosageTable } from "@/lib/openfda";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type FormulationRow = Database["public"]["Tables"]["formulations"]["Row"];

export function rowToFormulation(row: FormulationRow): Formulation {
  return {
    id: row.id,
    slug: row.slug,
    brandName: row.brand_name,
    genericName: row.generic_name,
    dosageForm: row.dosage_form,
    isFictional: row.is_fictional,
    ndcPackages: row.ndc_packages,
    activeIngredients: catalogIngredientSchema.array().parse(row.active_ingredients),
    directionsText: row.directions_text,
    max24hText: row.max_24h_text,
    warningsQuotes: row.warnings_quotes,
    // Sanitized at ingest; again on the way out (table tags only), so client components such as the
    // medicine card can render it without shipping the sanitizer to the browser.
    dosageTableHtml: row.dosage_table_html ? sanitizeDosageTable(row.dosage_table_html) || null : null,
    source: row.source as Formulation["source"],
    openfdaSetId: row.openfda_set_id,
    labelEffectiveDate: row.label_effective_date,
    labelerName: row.labeler_name,
    labelSections: labelSectionsSchema.parse(row.label_sections),
    sourceLinks: sourceLinkSchema.array().parse(row.source_links),
    reviewed: row.reviewed_at !== null,
  };
}

export async function listFormulations(): Promise<Formulation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("formulations").select("*").order("brand_name");
  if (error) throw error;
  return data.map(rowToFormulation);
}

export async function getFormulation(id: string): Promise<Formulation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("formulations").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? rowToFormulation(data) : null;
}

/** Catalog rows whose brand or generic name resembles `query`, best first (the `search_formulations` RPC). */
export async function searchFormulations(query: string, max = 8): Promise<Formulation[]> {
  const q = query.trim();
  if (!q) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_formulations", { query: q, max_results: max });
  if (error) throw error;
  return data.map(rowToFormulation);
}

export async function getFormulationsByIds(ids: string[]): Promise<Record<string, Formulation>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.from("formulations").select("*").in("id", unique);
  if (error) throw error;
  return Object.fromEntries(data.map((row) => [row.id, rowToFormulation(row)]));
}
