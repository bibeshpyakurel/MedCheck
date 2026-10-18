import { describe, expect, it } from "vitest";
import { PHOTO_ISSUES, PHOTO_ISSUE_TIPS, parsePhotoIssue } from "./photo-issue";

describe("parsePhotoIssue (the ?why= code on the retake and review pages)", () => {
  it("accepts every known issue", () => {
    for (const issue of PHOTO_ISSUES) expect(parsePhotoIssue(issue)).toBe(issue);
  });

  it("rejects anything else, so a hand-edited URL shows the general advice", () => {
    for (const raw of [undefined, null, "", "GLARE", "smudge", ["glare"], 1]) expect(parsePhotoIssue(raw)).toBeNull();
  });
});

describe("PHOTO_ISSUE_TIPS", () => {
  it("has a reason and a tip for every issue", () => {
    for (const issue of PHOTO_ISSUES) {
      expect(PHOTO_ISSUE_TIPS[issue].reason.length).toBeGreaterThan(0);
      expect(PHOTO_ISSUE_TIPS[issue].tip.length).toBeGreaterThan(0);
    }
  });

  it("talks only about the photo, never about the medicine or a dose", () => {
    const words = Object.values(PHOTO_ISSUE_TIPS).flatMap((t) => [t.reason, t.tip]).join(" ");
    expect(words).not.toMatch(/\b(dose|safe|mg|mL|take|give)\b/i);
  });
});
