import "server-only";

// Orchestrates photo extraction for one source document: Gemini when available, otherwise a
// blank draft the user fills in. Used by the photo upload Server Action and POST /api/extract.
import type { EntryFields, SourceDocument, SourceDocumentKind } from "@/lib/domain/schema";
import type { PhotoIssue } from "@/lib/photo-issue";
import { createDraftEntry, downloadLabelPhoto, updateSourceDocument } from "@/lib/records";
import { extractFromPhoto, type DocumentDetails } from "./extract-label";
import { hasGeminiKey } from "./model";
import { unknownEntryFields } from "./raw-fields";

/** Why the review screen should show a message. Codes travel in the review URL (`?notice=`). */
export type ExtractionNotice = "ai-unavailable" | "ai-failed" | "nothing-found" | "several-found";

/**
 * One draft per medication found (or one blank draft); `firstFields` are the first draft's fields.
 * `kind` is what Gemini said the photo shows, saved on the document; a medicine package when Gemini
 * wasn't sure, isn't configured or failed. `photoIssue` is why Gemini said the photo was hard to read
 * (null when it didn't say or wasn't asked).
 */
export type ExtractionOutcome = {
  entryIds: string[];
  notice: ExtractionNotice | null;
  firstFields: EntryFields;
  kind: SourceDocumentKind;
  photoIssue: PhotoIssue | null;
};

/** What a photo counts as when Gemini can't say. */
const DEFAULT_KIND: SourceDocumentKind = "otc_package";

export async function extractIntoDrafts(doc: SourceDocument): Promise<ExtractionOutcome> {
  if (!doc.photoPath) throw new Error("Source document has no photo");

  let medications = [unknownEntryFields({ kind: "photo", sourceDocumentId: doc.id })];
  let notice: ExtractionNotice | null = null;
  let kind = DEFAULT_KIND;
  let found: DocumentDetails | null = null;
  let photoIssue: PhotoIssue | null = null;

  if (!hasGeminiKey()) {
    notice = "ai-unavailable";
  } else {
    try {
      const blob = await downloadLabelPhoto(doc.photoPath);
      const image = new Uint8Array(await blob.arrayBuffer());
      const result = await extractFromPhoto(image, blob.type || "image/jpeg", doc.id);
      kind = result.documentKind ?? DEFAULT_KIND;
      found = result.document;
      photoIssue = result.photoIssue;
      if (result.medications.length === 0) notice = "nothing-found";
      else {
        medications = result.medications;
        if (medications.length > 1) notice = "several-found";
      }
    } catch (error) {
      console.error("Gemini extraction failed", error);
      notice = "ai-failed";
    }
  }

  await saveDocumentRead(doc, kind, found);

  const entryIds: string[] = [];
  for (const fields of medications) {
    const entry = await createDraftEntry({
      patientId: doc.patientId,
      sourceDocumentId: doc.id,
      formulationId: null,
      inputMethod: "photo",
      fields,
    });
    entryIds.push(entry.id);
  }
  return { entryIds, notice, firstFields: medications[0], kind, photoIssue };
}

/** Saves the kind and what the model read off the document, without overwriting details already set. */
async function saveDocumentRead(doc: SourceDocument, kind: SourceDocumentKind, found: DocumentDetails | null): Promise<void> {
  const patch: Partial<DocumentDetails> & { kind?: SourceDocumentKind } = {};
  if (kind !== doc.kind) patch.kind = kind;
  for (const key of ["documentDate", "facility", "prescriber", "pharmacy"] as const) {
    if (found?.[key] && !doc[key]) patch[key] = found[key];
  }
  if (Object.keys(patch).length > 0) await updateSourceDocument(doc.id, patch);
}
