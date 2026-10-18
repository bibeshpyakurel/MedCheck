// The add-a-medicine flow's progress and exits. Pure; safe on client and server.

export type AddFlowScreen = "photo" | "scan" | "match" | "retake" | "review" | "saved";

const STEPS: Record<AddFlowScreen, { step: number; name: string }> = {
  photo: { step: 1, name: "Photo" },
  scan: { step: 1, name: "Scan" },
  match: { step: 2, name: "Match" },
  retake: { step: 2, name: "Match" },
  review: { step: 2, name: "Check the details" },
  saved: { step: 3, name: "Saved" },
};

const TOTAL = 3;

/** "Step 2 of 3 · Match": photo or scan → match (or check the details) → saved. */
export function addFlowStep(screen: AddFlowScreen): { step: number; total: number; label: string } {
  const { step, name } = STEPS[screen];
  return { step, total: TOTAL, label: `Step ${step} of ${TOTAL} · ${name}` };
}

/**
 * Where Confirm or Save for later goes from the per-field review: back to the medicine's detail page
 * when the review was opened from it (`from=entry`), else the next draft waiting, else the Medicines page.
 */
export function afterReviewPath(input: {
  patientId: string;
  entryId: string;
  from: "entry" | null;
  nextDraftId: string | null;
}): string {
  const base = `/patients/${input.patientId}`;
  if (input.from === "entry") return `${base}/entries/${input.entryId}`;
  return input.nextDraftId ? `${base}/entries/${input.nextDraftId}/review` : base;
}
