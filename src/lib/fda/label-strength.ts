// Strengths as the label prints them, from its "Active ingredient(s)" text. Pure.
// Every catalog strength must be traceable to this text: the NDC Directory's structured value is only
// used to confirm it (it carries typos like "200 mg/1201", ion-basis values under salt names, and
// whole-package amounts).
//
// An amount belongs to an ingredient only when it follows that ingredient's own name directly — with
// nothing in between but salt words and abbreviations ("HCl", "USP", "polacrilex"), dot leaders,
// punctuation, a parenthetical without numbers ("(NSAID)"), an apothecary amount before a metric one
// ("10 gr (648 mg)"), or "(equal to …)". Anything else — another word, an unreadable unit ("650 mgr") —
// means the label doesn't print an amount for it there.
import type { CatalogIngredient, Strength } from "@/lib/domain/schema";
import { normalizeIngredient } from "@/lib/domain/ingredients";
import { labelPerMarkers, labelPers, type LabelPer } from "./strength";

export type PrintedUnit = "mg" | "mcg" | "g" | "%";

export type Printed = {
  amount: number;
  unit: PrintedUnit;
  /** "100 mg/5 mL" or "100 mg per 5 mL" written next to the amount. */
  perVolume: number | null;
  /** For a percent: the basis the label states right after it, if any. */
  basis: "w/v" | "w/w" | null;
  /** "Ranitidine 75 mg (as ranitidine hydrochloride 84 mg)": the label's leading name, which names this amount. */
  baseName: string | null;
  /** The ingredient name as the label prints it at this occurrence. */
  printedName: string;
  /** The "(in each …)" printed closest before this amount (labels with several dose blocks). */
  context: LabelPer | null;
  /** "1.745g per fl oz". */
  perFlOz: boolean;
  /** Where the name starts and the amount ends in the text. */
  start: number;
  end: number;
};

const UNIT = String.raw`(milligrams?|micrograms?|grams?|mg|mcg|µg|μg|g|%)(?![\p{L}\d])`;
const AMOUNT_AT = new RegExp(String.raw`^(\d[\d,]*(?:\.\d+)?|\.\d+)\s*${UNIT}`, "iu");
const ANY_NUMBER_AT = /^(\d[\d,]*(?:\.\d+)?|\.\d+)\s*([\p{L}%]*)/u;
const UNIT_WORDS: Record<string, PrintedUnit> = { milligram: "mg", microgram: "mcg", gram: "g", µg: "mcg", μg: "mcg" };

/** Words allowed between a name and its amount. */
const QUALIFIERS = new Set(
  (
    "usp nf hcl hbr hci hydrochloride hydrobromide dihydrochloride sodium potassium calcium magnesium succinate maleate citrate " +
    "sulfate tartrate bitartrate polacrilex monohydrate dihydrate trihydrate sesquihydrate anhydrous base acetate carbonate " +
    "phosphate gluconate bromide chloride fumarate mesylate besylate salicylate equal equivalent to as micronized " +
    "delayed extended release capsule capsules tablet tablets caplet caplets softgel softgels chewable"
  ).split(" "),
);
const PAREN_AMOUNT_PREFIX = /^\(\s*(?:equal to|equivalent to|as|providing|contains)?\s*$/i;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Parenthesis depth at every index (unmatched ")" never goes below 0). */
export function parenDepths(text: string): number[] {
  const depths: number[] = [];
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") depth++;
    depths.push(depth);
    if (text[i] === ")") depth = Math.max(0, depth - 1);
  }
  return depths;
}

function words(name: string): string[] {
  return name.toLowerCase().replace(/[^\p{L}\d\s-]/gu, " ").split(/\s+/).filter(Boolean);
}

/** Names to look for, most specific first. A one-word name shared with another ingredient is ambiguous. */
function candidates(ndcName: string, others: string[]): string[] {
  const w = words(ndcName);
  const otherFirst = new Set(others.map((o) => words(o)[0]));
  const normalized = words(normalizeIngredient(ndcName));
  const list = [w.join(" "), w.slice(0, 2).join(" "), normalized.join(" ")];
  if (!otherFirst.has(w[0])) list.push(w[0]);
  if (normalized[0] && !otherFirst.has(normalized[0])) list.push(normalized[0]);
  return [...new Set(list.filter((c) => c.length >= 3))];
}

function readAmount(text: string, at: number): { amount: number; unit: PrintedUnit; end: number } | null {
  const m = text.slice(at).match(AMOUNT_AT);
  if (!m) return null;
  const word = m[2].toLowerCase().replace(/s$/, "");
  return { amount: Number(m[1].replace(/,/g, "")), unit: (UNIT_WORDS[word] ?? word) as PrintedUnit, end: at + m[0].length };
}

/** From just after a name, the amount that belongs to it, or null (see the file comment). */
function amountAfterName(text: string, from: number): { amount: number; unit: PrintedUnit; at: number; end: number } | null {
  let p = from;
  let qualifiers = 0;
  for (let guard = 0; guard < 40 && p < text.length; guard++) {
    const ch = text[p];
    if (/\s/.test(ch)) {
      p++;
      continue;
    }
    // "….325 mg" after dot leaders is 325; " .5 mg" after a space is 0.5.
    if (ch === "." && /\d/.test(text[p + 1] ?? "") && !/[.…]/.test(text[p - 1] ?? "")) {
      const a = readAmount(text, p);
      return a ? { ...a, at: p } : null;
    }
    if (/[,:;*…·.\-–—/_]/.test(ch)) {
      p++;
      continue;
    }
    if (ch === "(") {
      const close = text.indexOf(")", p);
      if (close < 0) return null;
      const inner = text.slice(p, close + 1);
      if (!/\d/.test(inner)) {
        p = close + 1;
        continue;
      }
      // "(648 mg)", "(equal to 4 mg nicotine)": the amount inside counts.
      const m = inner.match(/\d|\.\d/);
      const at = p + (m?.index ?? 0);
      if (!PAREN_AMOUNT_PREFIX.test(text.slice(p, at))) return null;
      const a = readAmount(text, at);
      return a ? { ...a, at } : null;
    }
    if (/\d/.test(ch)) {
      const a = readAmount(text, p);
      if (a) return { ...a, at: p };
      // "10 gr (648 mg)": skip the apothecary amount, the metric one follows in parentheses.
      const n = text.slice(p).match(ANY_NUMBER_AT);
      if (n && /^(?:gr|grains?)$/i.test(n[2]) && text.slice(p + n[0].length).trimStart().startsWith("(")) {
        p += n[0].length;
        continue;
      }
      return null; // "650 mgr", "3350" with no unit, "1000 IU"
    }
    const w = text.slice(p).match(/^[\p{L}'’]+/u)?.[0];
    if (!w) return null;
    const isAbbreviation = /^[A-Z][A-Za-z]{1,4}$/.test(w) && (w.match(/[A-Z]/g) ?? []).length >= 2; // HCl, HBr, USP
    if (!(QUALIFIERS.has(w.toLowerCase()) || isAbbreviation) || ++qualifiers > 4) return null;
    p += w.length;
  }
  return null;
}

/** "Dextromethorphan HBr ......", "Famotidine USP", "Nicotine polacrilex (" → the name as the label prints it. */
function displayName(raw: string): string {
  const name = raw
    .replace(/\([^)]*\)?/g, " ")
    .replace(/\d+(?:\.\d+)?\s*(?:gr|grains?)\b/gi, " ")
    .replace(/[.…·_:;,*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(?:\s+(?:usp|nf|equal to|equivalent to|as|delayed-release|extended-release|delayed|extended|release|capsules?|tablets?|caplets?|softgels?|chewable))+$/i, "")
    .trim();
  if (name === name.toUpperCase()) return name.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Every amount the label prints for one ingredient (a label may print several strengths). */
export function findAllPrinted(activeText: string, ndcName: string, otherNames: string[]): Printed[] {
  const text = activeText;
  const lower = text.toLowerCase();
  const depth = parenDepths(text);
  const markers = labelPerMarkers(text);
  for (const name of candidates(ndcName, otherNames)) {
    const found: Printed[] = [];
    for (const m of lower.matchAll(new RegExp(`(?<![\\p{L}])${escapeRegExp(name)}(?![\\p{L}])`, "gu"))) {
      const start = m.index!;
      if (depth[start] > 0) continue;
      const a = amountAfterName(text, start + m[0].length);
      if (!a) continue;
      const rest = text.slice(a.end);
      const perVolume = rest.match(/^\s*(?:\/|per|in each|in)\s*(\d+(?:\.\d+)?)\s*ml\b/i);
      const basis = a.unit === "%" ? (rest.match(/^\s*\(?\s*(w\/v|w\/w)\b/i)?.[1].toLowerCase() as "w/v" | "w/w" | undefined) : undefined;
      const printedName = displayName(text.slice(start, a.at));
      const context = [...markers].reverse().find((k) => k.index < start)?.per ?? null;
      found.push({
        amount: a.amount,
        unit: a.unit,
        perVolume: perVolume ? Number(perVolume[1]) : null,
        basis: basis ?? null,
        baseName: /^\s*\(\s*(?:as|equivalent to|equal to)\b/i.test(rest) ? displayName(text.slice(start, a.at)) || null : null,
        printedName,
        context,
        perFlOz: /^\s*per\s+fl\.?\s*oz\b/i.test(rest),
        start,
        end: a.end,
      });
    }
    if (found.length > 0) return found;
  }
  return [];
}

/** The first amount the label prints for an ingredient, or null. */
export function findPrinted(activeText: string, ndcName: string, otherNames: string[]): Printed | null {
  return findAllPrinted(activeText, ndcName, otherNames)[0] ?? null;
}

const MG = { mg: 1, mcg: 0.001, g: 1000 } as const;

/** mg per mL, mg per g, or mg per count unit — for comparing two statements of one strength. */
function canonical(s: Strength): { kind: string; value: number } | null {
  const mg = MG[s.unit as keyof typeof MG];
  if (mg === undefined) return null;
  const per = s.perAmount ?? 1;
  const unit = s.perUnit ?? "";
  if (unit === "mL") return { kind: "mL", value: (s.amount * mg) / per };
  if (unit === "L") return { kind: "mL", value: (s.amount * mg) / (per * 1000) };
  if (unit === "fl oz") return { kind: "mL", value: (s.amount * mg) / (per * 29.5735) }; // comparison only, never stored
  if (unit === "g") return { kind: "g", value: (s.amount * mg) / per };
  if (unit === "mg") return { kind: "g", value: (s.amount * mg) / (per / 1000) };
  return { kind: "count", value: (s.amount * mg) / per };
}

/** Same strength stated two ways (rounding allowed: 21.67 mg/mL ≈ 650 mg/30 mL). */
export function equivalent(a: Strength, b: Strength): boolean {
  const x = canonical(a);
  const y = canonical(b);
  if (!x || !y || x.kind !== y.kind) return false;
  return Math.abs(x.value - y.value) <= 0.02 * Math.max(x.value, y.value);
}

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, a, b);

/** The single volume the label's "(in each 5 mL)" gives, if any. */
export function labelVolume(activeText: string): number | null {
  const volumes = [...new Set(labelPers(activeText).flatMap((p) => (p.kind === "volume" ? [p.amount] : [])))];
  return volumes.length === 1 ? volumes[0] : null;
}

/** The single count the label's "(in each 3 mini-tablet dose)" gives, if any (1 when it names one unit). */
export function labelCount(activeText: string): number | null {
  const counts = [...new Set(labelPers(activeText).flatMap((p) => (p.kind === "count" ? [p.amount ?? 1] : [])))];
  return counts.length === 1 ? counts[0] : null;
}

/**
 * Whole-run gate: the stored strength is one of the amounts printed right after this ingredient's own
 * name — same amount in mg, or a percent restated as mg per 1 mL / 1 g — with the label's own
 * per-quantity ("in each 5 mL", "in each 3 mini-tablet dose", or one unit of a solid).
 */
export function strengthIsTraceable(ingredient: CatalogIngredient, otherNames: string[], activeText: string): boolean {
  const s = ingredient.strength;
  const mg = MG[s.unit as keyof typeof MG];
  const printed = findAllPrinted(activeText, ingredient.name, otherNames);
  return printed.some((p) => {
    if (p.unit === "%") {
      return s.unit === "mg" && s.perAmount === 1 && (s.perUnit === "mL" || s.perUnit === "g") && close(s.amount, p.amount * 10);
    }
    if (mg === undefined || !close(s.amount * mg, p.amount * MG[p.unit])) return false;
    const volume = p.perVolume ?? (p.context?.kind === "volume" ? p.context.amount : null) ?? labelVolume(activeText);
    if (s.perUnit === "fl oz") return p.perFlOz || /\bfl\.? ?oz\b|fluid ounce/i.test(activeText);
    if (volume !== null) return s.perUnit === "mL" && close(s.perAmount ?? 1, volume);
    if (s.perUnit === "mL" || s.perUnit === "L" || s.perUnit === "g" || s.perUnit === "mg") return false; // the label gives no per-quantity
    const count = p.context?.kind === "count" ? (p.context.amount ?? 1) : labelCount(activeText);
    return close(s.perAmount ?? 1, count ?? 1);
  });
}
