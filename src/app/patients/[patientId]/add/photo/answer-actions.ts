"use server";

// The photo pop-up's steps (spec: photo answers §2–§4): find each medicine read from a package photo
// in the FDA list, preview the picked labels, then save them all or discard the whole photo. Only the
// user's own drafts from their own medicine-package photo (RLS, plus the checks in `ownPhotoDrafts`).
import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getFormulation, getFormulationsByIds } from "@/lib/catalog";
import { isReadable, photoReadFromFields, trustedCodeMatch, type CatalogMatch } from "@/lib/catalog-match";
import { findCatalogMatches } from "@/lib/catalog-match-server";
import { confirmedFieldsFromFormulation } from "@/lib/domain/fields";
import type { Formulation, MedicationEntry } from "@/lib/domain/schema";
import type { PhotoMatchItem, PhotoPick } from "@/lib/photo-answers";
import { matchChoices, typedNameFields } from "@/lib/photo-flow";
import { confirmDraftEntry, deleteEntry, deleteSourceDocument, getSourceDocument, listDocumentEntries } from "@/lib/records";

/** `gone`: the photo's medicines were already saved or discarded (another tab, say). */
export type AnswerError = { error: string; gone?: true };

const GONE: AnswerError = { error: "The medicines from this photo were already saved, removed, or aren't yours to change.", gone: true };

const docSchema = z.object({ patientId: z.guid(), sourceDocumentId: z.guid() });
const pickSchema = z.union([
  z.object({ entryId: z.guid(), formulationId: z.guid() }),
  z.object({ entryId: z.guid(), typedName: z.string().trim().min(1).max(200) }),
]);
const picksSchema = docSchema.extend({ picks: z.array(pickSchema).min(1).max(20) });

/** The document's drafts, when it is the user's own medicine-package photo of this person; else null. */
async function ownPhotoDrafts(input: { patientId: string; sourceDocumentId: string }) {
  await requireUser();
  const doc = await getSourceDocument(input.sourceDocumentId);
  if (!doc || doc.patientId !== input.patientId || doc.kind !== "otc_package") return null;
  const entries = await listDocumentEntries(doc.id);
  return { doc, entries, drafts: entries.filter((e) => e.status === "draft") };
}

/** "Is this …?": each medicine Gemini read from the photo, matched to the FDA list (in parallel). */
export async function photoMatchesAction(input: { patientId: string; sourceDocumentId: string }): Promise<{ items: PhotoMatchItem[] } | AnswerError> {
  const parsed = docSchema.safeParse(input);
  if (!parsed.success) return GONE;
  const own = await ownPhotoDrafts(parsed.data);
  if (!own || own.drafts.length === 0) return GONE;
  const items = await Promise.all(
    own.drafts.map(async (entry): Promise<PhotoMatchItem> => {
      const read = photoReadFromFields(entry.fields);
      const [matches, codeLabel] = await Promise.all([
        findCatalogMatches(read).catch((error): CatalogMatch[] => {
          console.error("Catalog match failed", error);
          return [];
        }),
        // A draft linked to a label: the one its printed NDC or barcode points to.
        entry.formulationId ? getFormulation(entry.formulationId) : null,
      ]);
      const codeMatch = codeLabel ? trustedCodeMatch(read, codeLabel) : null;
      const { selectedId, options } = matchChoices(matches, codeMatch);
      const onlySearch = options.length === 0 || (!isReadable(read) && !codeMatch);
      return { entryId: entry.id, readName: read.productName, selectedId, options, onlySearch };
    }),
  );
  return { items };
}

type CheckedPicks = { drafts: MedicationEntry[]; picks: z.infer<typeof pickSchema>[]; formulations: Record<string, Formulation> };

/** The picks, when each names a different draft of this photo and every FDA label exists. */
async function checkPicks(input: unknown): Promise<CheckedPicks | AnswerError> {
  const parsed = picksSchema.safeParse(input);
  if (!parsed.success) return { error: "Pick a medicine for each one first." };
  const own = await ownPhotoDrafts(parsed.data);
  if (!own || own.drafts.length === 0) return GONE;
  const { picks } = parsed.data;
  const draftIds = new Set(own.drafts.map((d) => d.id));
  if (new Set(picks.map((p) => p.entryId)).size !== picks.length || picks.some((p) => !draftIds.has(p.entryId))) return GONE;
  const ids = picks.flatMap((p) => ("formulationId" in p ? [p.formulationId] : []));
  const formulations = await getFormulationsByIds(ids);
  if (ids.some((id) => !formulations[id])) return { error: "We couldn't find one of those medicines in the FDA list. Pick another." };
  return { drafts: own.drafts, picks, formulations };
}

/**
 * After Continue: the FDA labels picked, in pick order, for the answer card or the comparison.
 * Saves nothing — the user still chooses Save to My medicines or Don't save.
 */
export async function previewPicksAction(input: { patientId: string; sourceDocumentId: string; picks: PhotoPick[] }): Promise<{ formulations: Formulation[] } | AnswerError> {
  const checked = await checkPicks(input);
  if ("error" in checked) return checked;
  return { formulations: checked.picks.flatMap((p) => ("formulationId" in p ? [checked.formulations[p.formulationId]] : [])) };
}

/**
 * Save to My medicines: each picked draft is confirmed with its FDA label's values (the user's
 * Continue was the confirmation) or with the typed name only; drafts removed from the photo are
 * deleted. Then My medicines replaces the photo page in history.
 */
export async function savePicksAction(input: { patientId: string; sourceDocumentId: string; picks: PhotoPick[] }): Promise<AnswerError> {
  const checked = await checkPicks(input);
  if ("error" in checked) return checked;
  const { drafts, picks, formulations } = checked;
  try {
    for (const pick of picks) {
      if ("formulationId" in pick) {
        const formulation = formulations[pick.formulationId];
        await confirmDraftEntry(pick.entryId, confirmedFieldsFromFormulation(formulation), formulation.id);
      } else {
        const draft = drafts.find((d) => d.id === pick.entryId)!;
        await confirmDraftEntry(pick.entryId, typedNameFields(draft.fields, pick.typedName), null);
      }
    }
    const picked = new Set(picks.map((p) => p.entryId));
    for (const draft of drafts) if (!picked.has(draft.id)) await deleteEntry(draft.id);
  } catch (error) {
    console.error("Saving the photo's medicines failed", error);
    return { error: "We couldn't save these medicines. Check your connection and try again." };
  }
  redirect(`/patients/${input.patientId}`, RedirectType.replace);
}

/**
 * Cancel or Don't save: deletes what MedCheck read from this photo — its drafts, and the photo itself
 * once nothing saved came from it. The pop-up then returns to the photo screen, cleared.
 */
export async function discardPhotoAction(input: { patientId: string; sourceDocumentId: string }): Promise<AnswerError | void> {
  const parsed = docSchema.safeParse(input);
  if (!parsed.success) return GONE;
  const own = await ownPhotoDrafts(parsed.data);
  if (!own) return;
  try {
    for (const draft of own.drafts) await deleteEntry(draft.id);
    if (own.entries.length === own.drafts.length) await deleteSourceDocument(own.doc);
  } catch (error) {
    console.error("Discarding the photo failed", error);
    return { error: "We couldn't discard this photo. Check your connection and try again." };
  }
}
