"use server";

import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getFormulation } from "@/lib/catalog";
import { findFormulationByCodes } from "@/lib/code-lookup";
import { confirmedFieldsFromFormulation } from "@/lib/domain/fields";
import { toMatchOption, type MatchOption } from "@/lib/photo-flow";
import { confirmDraftEntry, createDraftEntry, getPatient } from "@/lib/records";

export type ScanLookup = { status: "found"; option: MatchOption } | { status: "not-found" } | { status: "error" };

/**
 * A scanned or typed barcode / NDC → the one FDA label it belongs to (catalog first, then openFDA by
 * UPC; see `findFormulationByCodes`). Only looks; nothing is saved until the user confirms.
 */
export async function lookupScanAction(code: string): Promise<ScanLookup> {
  await requireUser();
  if (typeof code !== "string" || code.length > 64) return { status: "not-found" };
  try {
    const formulation = await findFormulationByCodes([code]);
    return formulation ? { status: "found", option: toMatchOption(formulation, "not_read", true) } : { status: "not-found" };
  } catch (error) {
    console.error("Barcode lookup failed", error);
    return { status: "error" };
  }
}

const confirmSchema = z.object({ patientId: z.guid(), formulationId: z.guid() });

/**
 * The one tap after a scan: the FDA label's values are saved as confirmed (the user's tap is the
 * confirmation), linked to that label. Then the entry page opens with its medicine card.
 */
export async function confirmScanAction(input: { patientId: string; formulationId: string }): Promise<{ error: string } | void> {
  await requireUser();
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { error: "Scan the barcode again." };
  const { patientId, formulationId } = parsed.data;

  // RLS: getPatient only returns the user's own people.
  const [patient, formulation] = await Promise.all([getPatient(patientId), getFormulation(formulationId)]);
  if (!patient) return { error: "We couldn't find this person's record." };
  if (!formulation) return { error: "We couldn't find that medicine in the FDA list. Scan again." };

  const fields = confirmedFieldsFromFormulation(formulation);
  const entry = await createDraftEntry({
    patientId,
    sourceDocumentId: null,
    formulationId: formulation.id,
    inputMethod: "barcode",
    fields,
  });
  await confirmDraftEntry(entry.id, fields, formulation.id);
  // Replace: Back from the saved medicine skips the scan that's already answered.
  redirect(`/patients/${patientId}/entries/${entry.id}?card=new`, RedirectType.replace);
}
