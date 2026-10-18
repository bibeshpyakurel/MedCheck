"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getFormulation } from "@/lib/catalog";
import { confirmedFieldsFromFormulation } from "@/lib/domain/fields";
import { typedNameFields } from "@/lib/photo-flow";
import { confirmDraftEntry, deleteEntry, getEntry } from "@/lib/records";

const idsSchema = z.object({ patientId: z.guid(), entryId: z.guid() });

/** The user's own draft from a medicine-package photo, or null. RLS limits getEntry to the user's rows. */
async function ownedPackageDraft(input: unknown) {
  await requireUser();
  const ids = idsSchema.safeParse(input);
  if (!ids.success) return null;
  const entry = await getEntry(ids.data.entryId);
  if (!entry || entry.patientId !== ids.data.patientId) return null;
  if (entry.status !== "draft" || entry.sourceDocument?.kind !== "otc_package") return null;
  return entry;
}

const NOT_A_DRAFT = "This medicine was already saved, or isn't yours to change. Go back to the Medicines page.";

/**
 * The one tap on "Is this the medicine?": the FDA label's values are saved as confirmed (the user's
 * tap is the confirmation), linked to that label. Then the entry page opens with its medicine card.
 */
export async function confirmMatchAction(input: {
  patientId: string;
  entryId: string;
  formulationId: string;
}): Promise<{ error: string } | void> {
  const entry = await ownedPackageDraft(input);
  if (!entry) return { error: NOT_A_DRAFT };
  if (!z.guid().safeParse(input.formulationId).success) return { error: "Pick a medicine first." };
  const formulation = await getFormulation(input.formulationId);
  if (!formulation) return { error: "We couldn't find that medicine in the FDA list. Pick another." };

  await confirmDraftEntry(entry.id, confirmedFieldsFromFormulation(formulation), formulation.id);
  redirect(`/patients/${entry.patientId}/entries/${entry.id}?card=new`);
}

/** Last resort: saves the typed name only; everything else is unknown and no FDA label is linked. */
export async function saveTypedNameAction(input: {
  patientId: string;
  entryId: string;
  name: string;
}): Promise<{ error: string } | void> {
  const entry = await ownedPackageDraft(input);
  if (!entry) return { error: NOT_A_DRAFT };
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) return { error: "Type the medicine's name first." };
  if (name.length > 200) return { error: "That name is too long." };

  await confirmDraftEntry(entry.id, typedNameFields(entry.fields, name), null);
  redirect(`/patients/${entry.patientId}`);
}

/** "Retake photo" after an unreadable package photo: drops its blank draft, then back to the camera. */
export async function retakePhotoAction(input: { patientId: string; entryId: string }): Promise<void> {
  const entry = await ownedPackageDraft(input);
  if (!entry) redirect("/");
  await deleteEntry(entry.id);
  redirect(`/patients/${entry.patientId}/add/photo?kind=otc_package&source=camera`);
}
