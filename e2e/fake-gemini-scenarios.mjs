// What the e2e Gemini stand-in (fake-gemini.mjs) reads from a photo, keyed by the photo's width in
// pixels: the browser re-encodes every photo as JPEG before upload, so only the pixels survive.
// Shared by the stand-in and e2e/support.ts.

export const FAKE_GEMINI_PORT = 3999;

/** Photo width → scenario. Any other width reads as "no medicine found". */
export const SCENARIO_WIDTHS = {
  /** A Tylenol Extra Strength package: brand, caplets, acetaminophen 500 mg per caplet. */
  tylenolExtraStrength: 500,
  /** A package with nothing legible: one medication, every value null. */
  unreadable: 520,
};
