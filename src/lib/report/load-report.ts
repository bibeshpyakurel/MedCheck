import "server-only";

// Loads everything the medicine report needs, as the signed-in user (RLS decides visibility).
import { getFormulationsByIds } from "@/lib/catalog";
import { runChecks } from "@/lib/checks";
import type { CheckRun } from "@/lib/domain/schema";
import { getCaregiver, getPatient, listEntries } from "@/lib/records";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { buildReport, type Report } from "./build-report";

export async function loadReport(
  patientId: string,
  opts: { timeZone?: string } = {},
): Promise<{ report: Report; runs: CheckRun[] } | null> {
  const patient = await getPatient(patientId);
  if (!patient) return null;
  const [caregiver, entries] = await Promise.all([getCaregiver(), listEntries(patientId)]);
  const confirmed = entries.filter((e) => e.status === "confirmed");
  const formulations = await getFormulationsByIds(
    confirmed.map((e) => e.formulationId).filter((id): id is string => id !== null),
  );
  const runs = runChecks({ entries: confirmed, formulations });
  const report = buildReport({
    caregiverName: caregiver?.displayName ?? null,
    patient,
    entries,
    runs,
    generatedAt: new Date(),
    timeZone: opts.timeZone,
  });
  return { report, runs };
}

/** Records that a report was generated, with the findings as they stood. Returns the export id. */
export async function saveExport(patientId: string, report: Report, runs: CheckRun[]): Promise<string> {
  const supabase = await createClient();
  const snapshot = {
    generatedAt: report.generatedAt,
    medicines: report.medicines.map((m) => m.name),
    warnings: report.warnings.map((w) => w.title),
    runs,
  };
  const { data, error } = await supabase
    .from("exports")
    .insert({ patient_id: patientId, findings_snapshot: snapshot as unknown as Json })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** IANA zone sent by the browser (`?tz=` or body), so the PDF shows the user's local time. */
export function timeZoneParam(value: string | null | undefined): string | undefined {
  return value && /^[A-Za-z0-9_+\-/]{1,64}$/.test(value) ? value : undefined;
}
