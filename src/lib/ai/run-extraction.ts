import "server-only";

// Orchestrates photo extraction for one source document: Gemini when available, otherwise a
// blank draft the user fills in. Used by the photo upload Server Action and POST /api/extract.
import type { SourceDocument } from "@/lib/domain/schema";
import { createDraftEntry, downloadLabelPhoto, updateSourceDocument } from "@/lib/records";
import { extractFromPhoto, type DocumentDetails } from "./extract-label";
import { hasGeminiKey } from "./model";
import { unknownEntryFields } from "./raw-fields";

/** Why the review screen should show a message. Codes travel in the review URL (`?notice=`). */
export type ExtractionNotice = "ai-unavailable" | "ai-failed" | "nothing-found" | "several-found";

export type ExtractionOutcome = { entryIds: string[]; notice: ExtractionNotice | null };

export async function extractIntoDrafts(
  doc: SourceDocument,
  opts: { formulationId: string | null },
): Promise<ExtractionOutcome> {
  if (!doc.photoPath) throw new Error("Source document has no photo");

  let medications = [unknownEntryFields({ kind: "photo", sourceDocumentId: doc.id })];
  let notice: ExtractionNotice | null = null;

  if (!hasGeminiKey()) {
    notice = "ai-unavailable";
  } else {
    try {
      const blob = await downloadLabelPhoto(doc.photoPath);
      const image = new Uint8Array(await blob.arrayBuffer());
      const result = await extractFromPhoto(image, blob.type || "image/jpeg", doc.kind, doc.id);
      await fillDocumentDetails(doc, result.document);
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

  const entryIds: string[] = [];
  for (const [i, fields] of medications.entries()) {
    // A barcode's catalog link belongs to the one product photographed (the first medication).
    const formulationId = i === 0 ? opts.formulationId : null;
    const entry = await createDraftEntry({
      patientId: doc.patientId,
      sourceDocumentId: doc.id,
      formulationId,
      inputMethod: formulationId ? "barcode" : "photo",
      fields,
    });
    entryIds.push(entry.id);
  }
  return { entryIds, notice };
}

/** Saves what the model read off the document, without overwriting anything already set. */
async function fillDocumentDetails(doc: SourceDocument, found: DocumentDetails): Promise<void> {
  const patch: Partial<DocumentDetails> = {};
  for (const key of ["documentDate", "facility", "prescriber", "pharmacy"] as const) {
    if (found[key] && !doc[key]) patch[key] = found[key];
  }
  if (Object.keys(patch).length > 0) await updateSourceDocument(doc.id, patch);
}
