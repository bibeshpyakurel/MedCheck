"use server";

import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { deleteEntry, getEntry } from "@/lib/records";

const idsSchema = z.object({ patientId: z.guid(), entryId: z.guid() });

/**
 * The add flow's Cancel, once a photo was read: deletes the medicine still waiting for review, then
 * opens the Medicines page in its place in history. Only the user's own drafts (RLS); a medicine that
 * was already confirmed is left alone.
 */
export async function discardDraftAction(input: { patientId: string; entryId: string }): Promise<void> {
  await requireUser();
  const ids = idsSchema.safeParse(input);
  if (!ids.success) redirect("/");
  const entry = await getEntry(ids.data.entryId);
  if (entry?.patientId === ids.data.patientId && entry.status === "draft") await deleteEntry(entry.id);
  redirect(`/patients/${ids.data.patientId}`, RedirectType.replace);
}
