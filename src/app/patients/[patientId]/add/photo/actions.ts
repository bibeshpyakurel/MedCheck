"use server";

import { z } from "zod";
import { extractIntoDrafts, type ExtractionOutcome } from "@/lib/ai/run-extraction";
import { requireUser } from "@/lib/auth";
import { photoNextPath } from "@/lib/photo-flow";
import { createSourceDocument, deleteEntry, getEntry, getPatient, uploadLabelPhoto } from "@/lib/records";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

const inputSchema = z.object({
  patientId: z.guid(),
  kind: z.enum(["prescription_label", "discharge_list", "otc_package"]),
});

export type PhotoResult = { error: string } | { next: string; entryIds: string[] };

/**
 * Photo upload: store the photo → source document → extraction → the first draft's next step: a
 * medicine package goes to "Is this the medicine?" (or a retake); other photos to the per-field review.
 * Returns that path rather than redirecting, so the page can replace itself in history (Back then skips
 * the emptied photo step) or drop the drafts if the person cancelled while the photo was being read.
 */
export async function uploadPhotoAction(formData: FormData): Promise<PhotoResult> {
  await requireUser();
  const parsed = inputSchema.safeParse({
    patientId: formData.get("patientId"),
    kind: formData.get("kind"),
  });
  if (!parsed.success) return { error: "Choose what kind of photo this is." };
  const { patientId, kind } = parsed.data;

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return { error: "Take or choose a photo first." };
  if (photo.size > MAX_PHOTO_BYTES) return { error: "That photo is too large. Try again a little further away." };
  const contentType = photo.type || "image/jpeg";
  if (!ALLOWED_TYPES.includes(contentType)) return { error: "Use a JPEG, PNG, WebP or HEIC photo." };

  if (!(await getPatient(patientId))) return { error: "We couldn't find this person's record." };

  let outcome: ExtractionOutcome;
  try {
    const photoPath = await uploadLabelPhoto(photo, contentType);
    const doc = await createSourceDocument({ patientId, kind, photoPath });
    outcome = await extractIntoDrafts(doc);
  } catch (error) {
    console.error("Photo upload failed", error);
    return { error: "We couldn't save the photo. Check your connection and try again." };
  }

  return {
    next: photoNextPath({ patientId, entryId: outcome.entryIds[0], kind, notice: outcome.notice, fields: outcome.firstFields }),
    entryIds: outcome.entryIds,
  };
}

const discardSchema = z.object({ patientId: z.guid(), entryIds: z.array(z.guid()).max(50) });

/** Cancel while the photo was being read: deletes the drafts that read made. Only the user's own drafts (RLS). */
export async function discardReadAction(input: { patientId: string; entryIds: string[] }): Promise<void> {
  await requireUser();
  const parsed = discardSchema.safeParse(input);
  if (!parsed.success) return;
  for (const id of parsed.data.entryIds) {
    const entry = await getEntry(id);
    if (entry?.patientId === parsed.data.patientId && entry.status === "draft") await deleteEntry(id);
  }
}
