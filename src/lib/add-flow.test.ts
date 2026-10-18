import { describe, expect, it } from "vitest";
import { addFlowStep, afterReviewPath } from "./add-flow";

describe("addFlowStep (the add flow's progress label)", () => {
  it("taking the photo is step 1", () => {
    expect(addFlowStep("photo")).toEqual({ step: 1, total: 3, label: "Step 1 of 3 · Photo" });
  });

  it("scanning a barcode is step 1, like taking the photo", () => {
    expect(addFlowStep("scan")).toEqual({ step: 1, total: 3, label: "Step 1 of 3 · Scan" });
  });

  it("matching a package (or retaking an unreadable one) is step 2", () => {
    expect(addFlowStep("match").label).toBe("Step 2 of 3 · Match");
    expect(addFlowStep("retake").label).toBe("Step 2 of 3 · Match");
  });

  it("checking a label's details is step 2", () => {
    expect(addFlowStep("review")).toEqual({ step: 2, total: 3, label: "Step 2 of 3 · Check the details" });
  });

  it("saved is the last step", () => {
    expect(addFlowStep("saved")).toEqual({ step: 3, total: 3, label: "Step 3 of 3 · Saved" });
  });
});

describe("afterReviewPath (where Confirm and Save for later go)", () => {
  const at = { patientId: "p-1", entryId: "e-1" };

  it("returns to the medicine's detail page when the review was opened from it", () => {
    expect(afterReviewPath({ ...at, from: "entry", nextDraftId: "e-2" })).toBe("/patients/p-1/entries/e-1");
  });

  it("otherwise opens the next draft waiting for review", () => {
    expect(afterReviewPath({ ...at, from: null, nextDraftId: "e-2" })).toBe("/patients/p-1/entries/e-2/review");
  });

  it("otherwise goes to the Medicines page", () => {
    expect(afterReviewPath({ ...at, from: null, nextDraftId: null })).toBe("/patients/p-1");
  });
});
