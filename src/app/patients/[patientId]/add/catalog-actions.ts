"use server";

import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getFormulation } from "@/lib/catalog";
import { fieldsFromFormulation } from "@/lib/domain/fields";
import { createDraftEntry, getPatient } from "@/lib/records";
import { isUuid } from "@/lib/uuid";

/**
 * Creates a draft entry pre-filled from a scanned catalog formulation (barcode "Skip photo") and
 * opens it for review. Every field stays `pending` until the user confirms it.
 */
export async function addFromCatalog(formData: FormData): Promise<void> {
  await requireUser();
  const patientId = String(formData.get("patientId") ?? "");
  const formulationId = String(formData.get("formulationId") ?? "");

  if (!isUuid(patientId) || !isUuid(formulationId)) notFound();

  // RLS: getPatient only returns the caregiver's own patients.
  const [patient, formulation] = await Promise.all([getPatient(patientId), getFormulation(formulationId)]);
  if (!patient || !formulation) notFound();

  const entry = await createDraftEntry({
    patientId,
    sourceDocumentId: null,
    formulationId: formulation.id,
    inputMethod: "barcode",
    fields: fieldsFromFormulation(formulation),
  });
  redirect(`/patients/${patientId}/entries/${entry.id}/review`);
}
