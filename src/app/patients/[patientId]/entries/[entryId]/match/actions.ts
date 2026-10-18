"use server";

import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getFormulation } from "@/lib/catalog";
import { confirmedFieldsFromFormulation } from "@/lib/domain/fields";
import { typedNameFields } from "@/lib/photo-flow";
import { confirmDraftEntry, deleteEntry, getEntry } from "@/lib/records";

const idsSchema = z.object({ patientId: z.guid(), entryId: z.guid() });

/** The user's own entry, or null. RLS limits getEntry to the user's rows. */
async function ownedEntry(input: unknown) {
  await requireUser();
  const ids = idsSchema.safeParse(input);
  if (!ids.success) return null;
  const entry = await getEntry(ids.data.entryId);
  return entry && entry.patientId === ids.data.patientId ? entry : null;
}

/**
 * The user's own draft from a medicine-package photo. One that was already saved (say, Confirm tapped
 * again after going Back) opens its detail page instead; anything else is null.
 */
async function ownedPackageDraft(input: unknown) {
  const entry = await ownedEntry(input);
  if (entry?.status === "confirmed") redirect(`/patients/${entry.patientId}/entries/${entry.id}`, RedirectType.replace);
  if (!entry || entry.status !== "draft" || entry.sourceDocument?.kind !== "otc_package") return null;
  return entry;
}

/** `gone`: the picker offers "Go to My medicines" with the message. */
type MatchResult = Promise<{ error: string; gone?: true } | void>;

const NOT_A_DRAFT = { error: "This medicine was already saved, removed, or isn't yours to change.", gone: true } as const;

/**
 * The one tap on "Is this the medicine?": the FDA label's values are saved as confirmed (the user's
 * tap is the confirmation), linked to that label. Then the entry page opens with its medicine card.
 */
export async function confirmMatchAction(input: {
  patientId: string;
  entryId: string;
  formulationId: string;
}): MatchResult {
  const entry = await ownedPackageDraft(input);
  if (!entry) return NOT_A_DRAFT;
  if (!z.guid().safeParse(input.formulationId).success) return { error: "Pick a medicine first." };
  const formulation = await getFormulation(input.formulationId);
  if (!formulation) return { error: "We couldn't find that medicine in the FDA list. Pick another." };

  await confirmDraftEntry(entry.id, confirmedFieldsFromFormulation(formulation), formulation.id);
  // Replace: Back from the saved medicine skips this already-answered question.
  redirect(`/patients/${entry.patientId}/entries/${entry.id}?card=new`, RedirectType.replace);
}

/** Last resort: saves the typed name only; everything else is unknown and no FDA label is linked. */
export async function saveTypedNameAction(input: {
  patientId: string;
  entryId: string;
  name: string;
}): MatchResult {
  const entry = await ownedPackageDraft(input);
  if (!entry) return NOT_A_DRAFT;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) return { error: "Type the medicine's name first." };
  if (name.length > 200) return { error: "That name is too long." };

  await confirmDraftEntry(entry.id, typedNameFields(entry.fields, name), null);
  redirect(`/patients/${entry.patientId}`, RedirectType.replace);
}

/** "Retake photo" after an unreadable package photo: drops its blank draft, then back to the camera. */
export async function retakePhotoAction(input: { patientId: string; entryId: string }): Promise<void> {
  const entry = await ownedPackageDraft(input);
  if (!entry) redirect("/");
  await deleteEntry(entry.id);
  redirect(`/patients/${entry.patientId}/add/photo?kind=otc_package&source=camera`, RedirectType.replace);
}
