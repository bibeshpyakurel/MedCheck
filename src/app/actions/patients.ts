"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createPatient, getCaregiver, upsertCaregiver } from "@/lib/records";

const text = (formData: FormData, key: string, max: number) => {
  const v = String(formData.get(key) ?? "").trim().slice(0, max);
  return v || null;
};

/** Adds a person to the caregiver's household, then opens their (empty) record. */
export async function addPatient(formData: FormData): Promise<void> {
  await requireUser();
  const displayName = text(formData, "displayName", 120);
  if (!displayName) redirect("/patients/new?error=name");
  if (!(await getCaregiver())) await upsertCaregiver();
  const patient = await createPatient({
    displayName,
    relationship: text(formData, "relationship", 120),
    notes: text(formData, "notes", 500),
  });
  revalidatePath("/patients");
  redirect(`/patients/${patient.id}`);
}
