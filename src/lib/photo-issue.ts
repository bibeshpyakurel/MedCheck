// Why Gemini couldn't read a photo, and what to change before retaking it. Pure; safe on client and server.
// Advice about the photo only — never about the medicine. The code travels in the URL (`?why=`).

export const PHOTO_ISSUES = ["glare", "blurry", "cut_off", "too_far", "too_dark", "not_medicine"] as const;
export type PhotoIssue = (typeof PHOTO_ISSUES)[number];

export const PHOTO_ISSUE_TIPS: Record<PhotoIssue, { reason: string; tip: string }> = {
  glare: {
    reason: "Light is reflecting off the label.",
    tip: "Tilt the package or move away from the lamp or window, so there's no shine on the print.",
  },
  blurry: {
    reason: "The photo is blurry.",
    tip: "Hold the phone steady and tap the label on screen to focus before the photo.",
  },
  cut_off: {
    reason: "Part of the label is cut off.",
    tip: "Fit the whole front of the package inside the frame.",
  },
  too_far: {
    reason: "The print is too small to read.",
    tip: "Move closer, so the name and strength fill most of the frame.",
  },
  too_dark: {
    reason: "The photo is too dark.",
    tip: "Find brighter light, or turn on the flash.",
  },
  not_medicine: {
    reason: "This doesn't look like a medicine label.",
    tip: "Photograph the front of the medicine package, where its name is printed.",
  },
};

/** A `?why=` value → a known issue, or null (missing, or a hand-edited URL). */
export function parsePhotoIssue(raw: unknown): PhotoIssue | null {
  return typeof raw === "string" && (PHOTO_ISSUES as readonly string[]).includes(raw) ? (raw as PhotoIssue) : null;
}
