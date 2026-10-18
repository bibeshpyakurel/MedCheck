"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { extractIntoDrafts, type ExtractionOutcome } from "@/lib/ai/run-extraction";
import { requireUser } from "@/lib/auth";
import { photoNextPath } from "@/lib/photo-flow";
import { createSourceDocument, getPatient, uploadLabelPhoto } from "@/lib/records";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

const inputSchema = z.object({
  patientId: z.guid(),
  kind: z.enum(["prescription_label", "discharge_list", "otc_package"]),
});

/**
 * Photo upload: store the photo → source document → extraction → the first draft's next step: a
 * medicine package goes to "Is this the medicine?" (or a retake); other photos to the per-field review.
 */
export async function uploadPhotoAction(formData: FormData): Promise<{ error: string } | void> {
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

  redirect(photoNextPath({ patientId, entryId: outcome.entryIds[0], kind, notice: outcome.notice, fields: outcome.firstFields }));
}
