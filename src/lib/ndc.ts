// NDC helpers. Pure; safe on client and server. The catalog stores the 11-digit 5-4-2 form with no hyphens.

/** "37000-523-02" → "37000052302" (pads to 5-4-2). Null unless it is a hyphenated NDC. */
export function ndc11FromHyphenated(ndc: string): string | null {
  const m = ndc.trim().match(/^(\d{4,5})-(\d{3,4})-(\d{1,2})$/);
  if (!m) return null;
  const [, labeler, product, pkg] = m;
  const digits = labeler.length + product.length + pkg.length;
  if (digits !== 10 && digits !== 11) return null; // 10-digit NDC, or already 5-4-2
  return labeler.padStart(5, "0") + product.padStart(4, "0") + pkg.padStart(2, "0");
}
