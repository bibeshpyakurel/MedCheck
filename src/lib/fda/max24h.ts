// The directions' own daily limit, verbatim ("do not exceed 3 tablets in a 24-hour period",
// "do not use more than 4 times a day"). Pure. Always a substring of the directions; nothing is computed.
import { parseMax24h } from "@/lib/openfda";

const START = String.raw`(?:do not (?:exceed|take more than|give more than|use more than|chew more than)|not to exceed|not more than|no more than|(?:take|use|give) only one dose)`;
const BODY = String.raw`(?:(?!do not|not to exceed|not more than|\bexceed\b)[^.•;■])*?`;
const END = String.raw`(?:(?:in|within|per|during)\s+(?:a\s+|any\s+|each\s+|one\s+)?24[- ]?(?:hours?|hrs?)(?:[- ]period)?|per\s+24[- ]?(?:hours?|hrs?)|(?:a|per|each|in one|in a)\s+day|daily)(?![\p{L}])(?:\s*\(24 hours\))?`;
const LIMIT = new RegExp(`${START}${BODY}${END}`, "giu");

/** The first daily limit in the directions — a 24-hour one before a "per day" one. Null if none. */
export function max24hText(directions: string | null): string | null {
  if (!directions) return null;
  const found = [...directions.matchAll(LIMIT)]
    .map((m) => m[0].trim())
    .filter((t) => t.length <= 90 && /\d|\bone\b/i.test(t.replace(/24[- ]?(?:hours?|hrs?)/gi, "")));
  const best = found.find((t) => /24[- ]?(?:hours?|hrs?)/i.test(t)) ?? found[0];
  return balanceParens(best ?? parseMax24h(directions), directions);
}

/** "…per day (24 hours": extend to the closing parenthesis in the source, else cut before it. */
export function balanceParens(snippet: string | null, source: string | null): string | null {
  if (!snippet) return snippet;
  const open = (snippet.match(/\(/g) ?? []).length - (snippet.match(/\)/g) ?? []).length;
  if (open <= 0) return snippet;
  const at = source?.indexOf(snippet) ?? -1;
  if (source && at >= 0) {
    const close = source.indexOf(")", at + snippet.length);
    if (close >= 0 && close - (at + snippet.length) <= 40) return source.slice(at, close + 1);
  }
  return snippet.slice(0, snippet.lastIndexOf("(")).trim() || null;
}
