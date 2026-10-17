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

/** What a barcode holds: its 10-digit NDC (when NDC-based) and its UPC as openFDA stores it. */
type Decoded = { ndc10: string | null; upc: string | null };

/** A UPC-A has a UPC; "3" + 10-digit NDC + check digit also has an NDC. */
function fromUpcA(upc: string): Decoded | null {
  if (!/^\d{12}$/.test(upc) || !hasValidCheckDigit(upc)) return null;
  return { ndc10: upc.startsWith("3") ? upc.slice(1, 11) : null, upc: `0${upc}` };
}

/** GTIN-14: indicator digit + "03" + NDC + check digit. With a "00" start it is a plain UPC-A. */
function fromGtin14(gtin: string): Decoded | null {
  if (!/^\d{14}$/.test(gtin) || !hasValidCheckDigit(gtin)) return null;
  const ndc10 = /^\d03/.test(gtin) ? gtin.slice(3, 13) : null;
  const upc = gtin.startsWith("00") ? gtin.slice(1) : null;
  return ndc10 || upc ? { ndc10, upc } : null;
}

const HYPHEN_LAYOUTS = [
  [4, 4, 2],
  [5, 3, 2],
  [5, 4, 1],
] as const;

/** Trims, drops an "NDC" prefix and GS1 separators, and turns typed spaces and dashes into "-". */
function clean(text: string): string {
  return text
    .replace(/[\u001dè]/g, "") // GS1 FNC1 / group separator
    .trim()
    .replace(/^ndc[\s:#]*/i, "")
    .replace(/[‐-―−]/g, "-") // en/em dashes and minus from phone keyboards
    .replace(/\s*-\s*|\s+/g, "-");
}

function decode(text: string): Decoded | null {
  const raw = clean(text);
  if (!raw) return null;

  // GS1 element string with application identifier 01 (GTIN).
  const ai = raw.match(/^\(01\)(\d{14})/) ?? (raw.length > 14 ? raw.match(/^01(\d{14})/) : null);
  if (ai) return fromGtin14(ai[1]);

  if (!/^\d+(-\d+)*$/.test(raw)) return null;
  const digits = raw.replace(/-/g, "");

  // A typed 10-digit NDC in three groups: must be one of the three FDA layouts.
  const groups = raw.split("-").map((p) => p.length);
  if (groups.length === 3 && digits.length === 10) {
    const ok = HYPHEN_LAYOUTS.some((l) => l[0] === groups[0] && l[1] === groups[1] && l[2] === groups[2]);
    return ok ? { ndc10: digits, upc: null } : null;
  }

  // Otherwise the groups are just how it was printed ("3 37000 52302 5" under the bars).
  if (digits.length === 10) return { ndc10: digits, upc: null };
  if (digits.length === 12) return fromUpcA(digits);
  if (digits.length === 13 && digits.startsWith("0") && hasValidCheckDigit(digits)) return fromUpcA(digits.slice(1));
  if (digits.length === 14) return fromGtin14(digits);
  return null;
}

/**
 * The 10-digit NDC in a scanned barcode or typed code, or null.
 * Accepts UPC-A, UPC-A read as EAN-13, GTIN-14 (plain, "(01)…" or raw GS1 DataMatrix text),
 * and an NDC typed with or without hyphens.
 */
export function parseBarcode(text: string): string | null {
  return decode(text)?.ndc10 ?? null;
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

/** The 10-digit hyphenated NDCs that pad to this 11-digit one (the padding zero can be in any segment). */
function hyphenatedFrom11(ndc11: string): string[] {
  const [labeler, product, pkg] = [ndc11.slice(0, 5), ndc11.slice(5, 9), ndc11.slice(9)];
  const out: string[] = [];
  if (labeler.startsWith("0")) out.push(`${labeler.slice(1)}-${product}-${pkg}`);
  if (product.startsWith("0")) out.push(`${labeler}-${product.slice(1)}-${pkg}`);
  if (pkg.startsWith("0")) out.push(`${labeler}-${product}-${pkg.slice(1)}`);
  return out;
}

/** What to look a code up by. */
export type NdcLookupKeys = {
  /** 11-digit 5-4-2 NDCs without hyphens, as the catalog stores them. */
  ndc11: string[];
  /** 10-digit hyphenated NDCs, as openFDA's `openfda.package_ndc` lists them. */
  hyphenated: string[];
  /** The UPC as openFDA's `openfda.upc` stores it (13 digits, leading 0); null for a typed NDC. */
  upc: string | null;
};

/**
 * Lookup keys for a scanned barcode or typed code, or null when it isn't one.
 * Real UPCs often carry a labeler code the FDA no longer lists (Tylenol boxes print 0045-…, the
 * label says 50580-…), so a UPC is looked up as a UPC too. An 11-digit NDC (plain or 5-4-2, as
 * pharmacy labels print it) is matched exactly.
 */
export function ndcLookupKeys(text: string): NdcLookupKeys | null {
  const raw = clean(text);
  const m = raw.match(/^(\d{5})-?(\d{4})-?(\d{2})$/);
  if (m) {
    const ndc11 = m[1] + m[2] + m[3];
    const hyphenated = hyphenatedFrom11(ndc11);
    return hyphenated.length > 0 ? { ndc11: [ndc11], hyphenated, upc: null } : null;
  }

  const decoded = decode(raw);
  if (!decoded) return null;
  const { ndc10, upc } = decoded;
  return { ndc11: ndc10 ? ndc11Candidates(ndc10) : [], hyphenated: ndc10 ? ndcHyphenatedCandidates(ndc10) : [], upc };
}
