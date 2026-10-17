"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { validateReviewFields } from "@/components/review/validation";
import type { DocumentDetails } from "@/lib/ai/extract-label";
import { requireUser } from "@/lib/auth";
import { isFullyReviewed } from "@/lib/domain/fields";
import type { EntryFields } from "@/lib/domain/schema";
import { confirmEntry, getEntry, listEntries, updateEntryFields, updateSourceDocument } from "@/lib/records";

type DocumentDetailsInput = DocumentDetails;

const detailsSchema = z.object({
  documentDate: z.iso.date().nullable(),
  facility: z.string().trim().max(200).nullable(),
  prescriber: z.string().trim().max(200).nullable(),
  pharmacy: z.string().trim().max(200).nullable(),
});

type Input = { patientId: string; entryId: string; fields: EntryFields; document: DocumentDetailsInput | null };

async function loadOwned({ patientId, entryId }: Input) {
  await requireUser();
  const entry = await getEntry(entryId);
  if (!entry || entry.patientId !== patientId) throw new Error("Entry not found");
  return entry;
}

async function saveDocument(sourceDocumentId: string | undefined, document: DocumentDetailsInput | null) {
  if (!sourceDocumentId || !document) return null;
  const parsed = detailsSchema.safeParse(document);
  if (!parsed.success) return "Check the document date (YYYY-MM-DD).";
  const blank = (s: string | null) => (s ? s : null);
  await updateSourceDocument(sourceDocumentId, {
    documentDate: parsed.data.documentDate,
    facility: blank(parsed.data.facility),
    prescriber: blank(parsed.data.prescriber),
    pharmacy: blank(parsed.data.pharmacy),
  });
  return null;
}

/** Saves progress without confirming, then returns to the record. */
export async function saveDraftAction(input: Input): Promise<{ error: string } | void> {
  const entry = await loadOwned(input);
  const fields = validateReviewFields(input.fields);
  if ("error" in fields) return fields;
  const docError = await saveDocument(entry.sourceDocument?.id, input.document);
  if (docError) return { error: docError };
  await updateEntryFields(entry.id, fields.fields);
  redirect(`/patients/${input.patientId}`);
}

/** Confirms the entry (only when nothing is left `pending`), then opens the next draft or the record. */
export async function confirmReviewAction(input: Input): Promise<{ error: string } | void> {
  const entry = await loadOwned(input);
  const fields = validateReviewFields(input.fields);
  if ("error" in fields) return fields;
  if (!isFullyReviewed(fields.fields)) return { error: "Choose Matches, Edit or Can't tell for every value first." };
  const docError = await saveDocument(entry.sourceDocument?.id, input.document);
  if (docError) return { error: docError };
  await confirmEntry(entry.id, fields.fields);

  const next = (await listEntries(input.patientId, { status: "draft" })).find((e) => e.id !== entry.id);
  redirect(next ? `/patients/${input.patientId}/entries/${next.id}/review` : `/patients/${input.patientId}`);
}
