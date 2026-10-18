// What the e2e Gemini stand-in (fake-gemini.mjs) reads from a photo, keyed by the photo's width in
// pixels: the browser re-encodes every photo as JPEG before upload, so only the pixels survive.
// Shared by the stand-in and e2e/support.ts.

export const FAKE_GEMINI_PORT = Number(process.env.FAKE_GEMINI_PORT) || 3999;

/** Photo width → scenario. Any other width reads as "no medicine found" (kind unsure: a package). */
export const SCENARIO_WIDTHS = {
  /** A Tylenol Extra Strength package: brand, caplets, acetaminophen 500 mg per caplet. */
  tylenolExtraStrength: 500,
  /** A package with nothing legible: one medication, every value null; Gemini blames glare. */
  unreadable: 520,
  /** Two packages in one photo: Advil (ibuprofen 200 mg tablet) and Tylenol Extra Strength (acetaminophen 500 mg caplet). */
  advilAndTylenol: 540,
  /** A pharmacy prescription label: amoxicillin 500 mg capsules, with directions, prescriber, pharmacy and fill date. */
  prescriptionLabel: 560,
  /** A prescription label with no medicine legible: the kind is known, nothing else. */
  prescriptionNothingRead: 580,
  /** A package where only the printed NDC is legible: "NDC 50580-449-10" (Tylenol Extra Strength caplets). */
  tylenolByCode: 600,
};
