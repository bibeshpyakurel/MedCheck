import "server-only";

import { catalogIngredientSchema, type Formulation } from "@/lib/domain/schema";
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
    dosageTableHtml: row.dosage_table_html,
    source: row.source as Formulation["source"],
    openfdaSetId: row.openfda_set_id,
    labelEffectiveDate: row.label_effective_date,
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

export async function getFormulationsByIds(ids: string[]): Promise<Record<string, Formulation>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.from("formulations").select("*").in("id", unique);
  if (error) throw error;
  return Object.fromEntries(data.map((row) => [row.id, rowToFormulation(row)]));
}

/** Catalog lookup by any of the given 11-digit NDCs (no hyphens). */
export async function findFormulationByNdc11(candidates: string[]): Promise<Formulation | null> {
  if (candidates.length === 0) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("formulations").select("*").overlaps("ndc_packages", candidates).limit(1);
  if (error) throw error;
  return data[0] ? rowToFormulation(data[0]) : null;
}
