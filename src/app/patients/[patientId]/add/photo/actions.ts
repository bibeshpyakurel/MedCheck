"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { extractIntoDrafts, type ExtractionOutcome } from "@/lib/ai/run-extraction";
import { requireUser } from "@/lib/auth";
import { getFormulation } from "@/lib/catalog";
import { createSourceDocument, getPatient, uploadLabelPhoto } from "@/lib/records";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

const inputSchema = z.object({
  patientId: z.guid(),
  kind: z.enum(["prescription_label", "discharge_list", "otc_package", "drug_facts_photo"]),
  formulationId: z.guid().nullable(),
});

/** Photo upload: store the photo → source document → extraction → review the first draft. */
export async function uploadPhotoAction(formData: FormData): Promise<{ error: string } | void> {
  await requireUser();
  const parsed = inputSchema.safeParse({
    patientId: formData.get("patientId"),
    kind: formData.get("kind"),
    formulationId: formData.get("formulationId") || null,
  });
  if (!parsed.success) return { error: "Choose what kind of photo this is." };
  const { patientId, kind, formulationId } = parsed.data;

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return { error: "Take or choose a photo first." };
  if (photo.size > MAX_PHOTO_BYTES) return { error: "That photo is too large. Try again a little further away." };
  const contentType = photo.type || "image/jpeg";
  if (!ALLOWED_TYPES.includes(contentType)) return { error: "Use a JPEG, PNG, WebP or HEIC photo." };

  if (!(await getPatient(patientId))) return { error: "We couldn't find this person's record." };
  if (formulationId && !(await getFormulation(formulationId))) return { error: "We couldn't find that scanned product." };

  let outcome: ExtractionOutcome;
  try {
    const photoPath = await uploadLabelPhoto(photo, contentType);
    const doc = await createSourceDocument({ patientId, kind, photoPath });
    outcome = await extractIntoDrafts(doc, { formulationId });
  } catch (error) {
    console.error("Photo upload failed", error);
    return { error: "We couldn't save the photo. Check your connection and try again." };
  }

  const query = outcome.notice ? `?notice=${outcome.notice}` : "";
  redirect(`/patients/${patientId}/entries/${outcome.entryIds[0]}/review${query}`);
}
