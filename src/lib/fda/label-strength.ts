// Strengths as the label prints them, from its "Active ingredient(s)" text. Pure.
// Every catalog strength must be traceable to this text: the NDC Directory's structured value is only
// used to confirm it (it carries typos like "200 mg/1201", ion-basis values under salt names, and
// whole-package amounts).
import type { CatalogIngredient, Strength } from "@/lib/domain/schema";
import { normalizeIngredient } from "@/lib/domain/ingredients";
import { labelPers } from "./strength";

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
  /** Where the name starts and the amount ends in the text. */
  start: number;
  end: number;
};

const AMOUNT = /(\d[\d,]*(?:\.\d+)?|\.\d+)\s*(mg|mcg|µg|μg|g|%)(?![\p{L}\d])/giu;

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

/**
 * The amount printed for one ingredient: its name outside parentheses, then the first amount after it
 * (outside parentheses, within 80 characters, before any other ingredient's name). Null when not printed.
 */
export function findPrinted(activeText: string, ndcName: string, otherNames: string[]): Printed | null {
  const text = activeText;
  const lower = text.toLowerCase();
  const depth = parenDepths(text);
  const otherStarts = otherNames
    .flatMap((o) => [...lower.matchAll(new RegExp(`(?<![\\p{L}])${escapeRegExp(words(o).join(" "))}(?![\\p{L}])`, "gu"))].map((m) => m.index!))
    .sort((a, b) => a - b);

  for (const name of candidates(ndcName, otherNames)) {
    const re = new RegExp(`(?<![\\p{L}])${escapeRegExp(name)}(?![\\p{L}])`, "gu");
    for (const m of lower.matchAll(re)) {
      const start = m.index!;
      if (depth[start] > 0) continue;
      const after = start + m[0].length;
      const limit = Math.min(text.length, after + 80, otherStarts.find((s) => s > after) ?? Infinity);
      AMOUNT.lastIndex = after;
      let a: RegExpExecArray | null;
      while ((a = AMOUNT.exec(text)) && a.index < limit) {
        if (depth[a.index] > 0) continue;
        const end = a.index + a[0].length;
        const rest = text.slice(end);
        const unit = a[2].toLowerCase().replace(/[µμ]g/, "mcg") as PrintedUnit;
        const perVolume = rest.match(/^\s*(?:\/|per|in each|in)\s*(\d+(?:\.\d+)?)\s*ml\b/i);
        const basis = unit === "%" ? (rest.match(/^\s*(w\/v|w\/w)\b/i)?.[1].toLowerCase() as "w/v" | "w/w" | undefined) : undefined;
        const asBase = /^\s*\(\s*(?:as|equivalent to|equal to)\b/i.test(rest);
        return {
          amount: Number(a[1].replace(/,/g, "")),
          unit,
          perVolume: perVolume ? Number(perVolume[1]) : null,
          basis: basis ?? null,
          baseName: asBase ? text.slice(start, a.index).replace(/[\s,:-]+$/, "").trim() || null : null,
          start,
          end,
        };
      }
    }
  }
  return null;
}

/** mg per mL, mg per g, or mg per count unit — for comparing two statements of one strength. */
function canonical(s: Strength): { kind: string; value: number } | null {
  const mg = { mg: 1, mcg: 0.001, g: 1000 }[s.unit as "mg" | "mcg" | "g"];
  if (mg === undefined) return null;
  const per = s.perAmount ?? 1;
  const unit = s.perUnit ?? "";
  if (unit === "mL") return { kind: "mL", value: (s.amount * mg) / per };
  if (unit === "L") return { kind: "mL", value: (s.amount * mg) / (per * 1000) };
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

/**
 * Whole-run gate: the stored strength is the ingredient's own printed amount — same number and unit, or a
 * percent restated as mg per 1 mL / 1 g — with the label's per-volume when the label gives one.
 */
export function strengthIsTraceable(ingredient: CatalogIngredient, otherNames: string[], activeText: string): boolean {
  const p = findPrinted(activeText, ingredient.name, otherNames);
  if (!p) return false;
  const s = ingredient.strength;
  if (p.unit === "%") {
    return s.unit === "mg" && s.perAmount === 1 && (s.perUnit === "mL" || s.perUnit === "g") && close(s.amount, p.amount * 10);
  }
  if (p.unit !== s.unit || !close(p.amount, s.amount)) return false;
  const volume = p.perVolume ?? labelVolume(activeText);
  if (volume !== null) return s.perUnit === "mL" && close(s.perAmount ?? 1, volume);
  return true;
}
