import "server-only";
import { getFormulationsByIds } from "@/lib/catalog";
import { runChecks } from "@/lib/checks";
import { overlappingIngredients } from "@/lib/overlap-visual";
import { listEntries } from "@/lib/records";

/** Normalized names of the ingredients a person's confirmed medicines share (amber chips off the home page). */
export async function sharedIngredients(patientId: string): Promise<Set<string>> {
  const confirmed = await listEntries(patientId, { status: "confirmed" });
  const formulations = await getFormulationsByIds(confirmed.flatMap((e) => (e.formulationId ? [e.formulationId] : [])));
  const findings = runChecks({ entries: confirmed, formulations }).flatMap((r) => r.findings);
  return overlappingIngredients(findings, new Map(confirmed.map((e) => [e.id, e])));
}
