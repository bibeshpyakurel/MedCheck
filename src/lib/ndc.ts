// NDC parsing for barcodes and typed codes. Pure; safe on client and server.
//
// A US drug package carries its 10-digit NDC inside a UPC-A ("3" + NDC + check digit) or a
// GS1 GTIN-14 (DataMatrix "(01)003" + NDC + check). The 10 digits don't say where the hyphens
// go (4-4-2, 5-3-2 or 5-4-1), so lookups try every layout. The catalog stores the 11-digit
// 5-4-2 form with no hyphens.

/** GS1 mod-10 check digit for `body` (all digits except the check digit). */
export function gs1CheckDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const digit = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  return (10 - (sum % 10)) % 10;
}

function hasValidCheckDigit(code: string): boolean {
  return gs1CheckDigit(code.slice(0, -1)) === Number(code.at(-1));
}

/** "3" + 10-digit NDC + check digit → the NDC, else null. */
function fromUpcA(upc: string): string | null {
  if (!/^3\d{11}$/.test(upc) || !hasValidCheckDigit(upc)) return null;
  return upc.slice(1, 11);
}

/** GTIN-14: indicator digit + "03" + NDC + check digit → the NDC, else null. */
function fromGtin14(gtin: string): string | null {
  if (!/^\d03\d{11}$/.test(gtin) || !hasValidCheckDigit(gtin)) return null;
  return gtin.slice(3, 13);
}

const HYPHEN_LAYOUTS = [
  [4, 4, 2],
  [5, 3, 2],
  [5, 4, 1],
] as const;

/**
 * The 10-digit NDC in a scanned barcode or typed code, or null.
 * Accepts UPC-A, UPC-A read as EAN-13, GTIN-14 (plain, "(01)…" or raw GS1 DataMatrix text),
 * and an NDC typed with or without hyphens.
 */
export function parseBarcode(text: string): string | null {
  const raw = text
    .replace(/[\u001dè]/g, "") // GS1 FNC1 / group separator
    .trim()
    .replace(/^ndc[\s:#]*/i, "");
  if (!raw) return null;

  // GS1 element string with application identifier 01 (GTIN).
  const ai = raw.match(/^\(01\)(\d{14})/) ?? (raw.length > 14 ? raw.match(/^01(\d{14})/) : null);
  if (ai) return fromGtin14(ai[1]);

  // A typed NDC with hyphens: must be one of the three FDA layouts.
  if (/^\d+-\d+-\d+$/.test(raw)) {
    const parts = raw.split("-").map((p) => p.length);
    const ok = HYPHEN_LAYOUTS.some((l) => l[0] === parts[0] && l[1] === parts[1] && l[2] === parts[2]);
    return ok ? raw.replace(/-/g, "") : null;
  }

  if (!/^\d+$/.test(raw)) return null;
  if (raw.length === 10) return raw;
  if (raw.length === 12) return fromUpcA(raw);
  if (raw.length === 13 && raw.startsWith("0") && hasValidCheckDigit(raw)) return fromUpcA(raw.slice(1));
  if (raw.length === 14) return fromGtin14(raw);
  return null;
}

/** The three possible hyphenations of a 10-digit NDC: 4-4-2, 5-3-2, 5-4-1. */
export function ndcHyphenatedCandidates(ndc10: string): string[] {
  if (!/^\d{10}$/.test(ndc10)) return [];
  return HYPHEN_LAYOUTS.map(([a, b]) => `${ndc10.slice(0, a)}-${ndc10.slice(a, a + b)}-${ndc10.slice(a + b)}`);
}

/** "37000-523-02" → "37000052302" (pads to 5-4-2). Null unless it is a hyphenated NDC. */
export function ndc11FromHyphenated(ndc: string): string | null {
  const m = ndc.trim().match(/^(\d{4,5})-(\d{3,4})-(\d{1,2})$/);
  if (!m) return null;
  const [, labeler, product, pkg] = m;
  const digits = labeler.length + product.length + pkg.length;
  if (digits !== 10 && digits !== 11) return null; // 10-digit NDC, or already 5-4-2
  return labeler.padStart(5, "0") + product.padStart(4, "0") + pkg.padStart(2, "0");
}

/** The 11-digit (5-4-2, no hyphens) forms a 10-digit NDC could have, one per layout. */
export function ndc11Candidates(ndc10: string): string[] {
  return ndcHyphenatedCandidates(ndc10).map((h) => ndc11FromHyphenated(h)!);
}
