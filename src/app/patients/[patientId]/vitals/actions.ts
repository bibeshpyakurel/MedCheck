"use server";

// Save a vitals reading the user accepted on the scan page: the numbers and their confidence only.
import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getPatient, insertVitalReading } from "@/lib/records";
import { hasAnyValue, vitalReadingSchema } from "@/lib/vitals";

export type VitalsError = { error: string };

const inputSchema = z.object({ patientId: z.guid(), reading: vitalReadingSchema });

/** Saves the reading, then My medicines replaces the scan page in history. */
export async function saveVitalReadingAction(input: unknown): Promise<VitalsError> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success || !hasAnyValue(parsed.data.reading)) return { error: "There's no reading to save. Scan again." };
  const { patientId, reading } = parsed.data;
  await requireUser();
  try {
    if (!(await getPatient(patientId))) return { error: "This record isn't yours to change." };
    await insertVitalReading(patientId, reading);
  } catch (error) {
    console.error("Saving the vitals reading failed", error);
    return { error: "We couldn't save this reading. Check your connection and try again." };
  }
  redirect(`/patients/${patientId}`, RedirectType.replace);
}
