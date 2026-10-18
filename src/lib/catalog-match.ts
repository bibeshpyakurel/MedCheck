// Photo → catalog matching. Pure; safe on client and server. Ranks catalog labels against what
// Gemini read from a package photo. It only ranks: the user's one tap is what confirms a product.
// Arithmetic here is internal, for comparing strengths only — never displayed.
import { normalizeIngredient } from "@/lib/domain/ingredients";
import type { EntryFields, Field, Formulation, Strength } from "@/lib/domain/schema";

export type PhotoRead = {
  productName: string | null;
  dosageForm: string | null;
  ingredients: { name: string | null; strength: Strength | null }[];
};
export type StrengthAgreement = "agrees" | "disagrees" | "not_read";
export type CatalogMatch = {
  formulation: Formulation;
  strengthAgreement: StrengthAgreement;
  score: number;
  /** Shares at least one normalized ingredient with the read, or its brand/generic name tokens overlap ≥ 0.5. */
  related: boolean;
};

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

const asRead = <T>(f: Field<T>): T | null => f.aiValue ?? f.value;

function text(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  return t ? t : null;
}

/** What Gemini read (aiValue, falling back to value) from a draft entry's fields. */
export function photoReadFromFields(fields: EntryFields): PhotoRead {
  return {
    productName: text(asRead(fields.productName)),
    dosageForm: text(asRead(fields.dosageForm)),
    ingredients: fields.ingredients
      .map((i) => ({ name: text(asRead(i.name)), strength: asRead(i.strength) }))
      .filter((i) => i.name !== null || i.strength !== null),
  };
}

/** True when the read has a product name or at least one ingredient name — otherwise ask for a retake. */
export function isReadable(read: PhotoRead): boolean {
  return text(read.productName) !== null || read.ingredients.some((i) => text(i.name) !== null);
}

// Package words that many products share; searched alone they drown out the brand
// ("Rolaids Extra Strength" ranked store-brand "Extra Strength" antacids first).
const STRENGTH = /\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|%)(?=\W|$)/gi;
const PACKAGE_WORDS =
  /\b(?:extra|maximum|max|regular|original|ultra|strength|fast|acting|rapid|relief|formula|advanced|plus|liqui-?gels?|liquid ?gels?|tablets?|caplets?|capsules?|softgels?|gelcaps?|geltabs?|chewables?|liquid|suspension)\b/gi;

/** "Zantac 360 Maximum Strength" → "Zantac 360"; null when nothing distinctive is left. */
function brandOnly(name: string | null): string | null {
  if (!name) return null;
  const core = name.replace(STRENGTH, " ").replace(PACKAGE_WORDS, " ").replace(/\s+/g, " ").trim();
  return core && core.toLowerCase() !== name.toLowerCase() ? core : null;
}

/**
 * Search terms to send to search_formulations, most specific first: brand as read, the brand alone
 * (no strength, marketing or form words), then ingredient names.
 */
export function searchTermsFor(read: PhotoRead): string[] {
  const terms = [
    text(read.productName),
    brandOnly(text(read.productName)),
    ...read.ingredients.map((i) => {
      const name = text(i.name);
      return name ? normalizeIngredient(name) : null;
    }),
  ];
  const seen = new Set<string>();
  return terms.filter((t): t is string => {
    if (!t || seen.has(t.toLowerCase())) return false;
    seen.add(t.toLowerCase());
    return true;
  });
}

// ---------------------------------------------------------------------------
// Strengths: compared by value. Liquids as mg per mL; solids per single unit, where every solid
// unit word is the same unit (labels say "caplet", the NDC Directory says "tablet" or "/1").
// ---------------------------------------------------------------------------

const MG_PER: Record<string, number> = { mg: 1, mcg: 0.001, g: 1000 };
const ML_PER: Record<string, number> = { ml: 1, milliliter: 1, millilitre: 1, l: 1000, liter: 1000, litre: 1000 };
const SOLID_UNIT =
  /tablet|caplet|capsule|softgel|soft gel|gelcap|geltab|liqui-?gel|liqui-?cap|chewable|lozenge|troche|pastille|gumm|pill|^(each|unit|piece|chew)$/;
const LIQUID_FORM = /liquid|suspension|solution|syrup|elixir|drops/;

const unitWord = (u: string) => u.trim().toLowerCase().replace(/\.$/, "").replace(/s$/, "");

/** A strength as (what is measured, per what, amount per one of that), or null when it can't be compared. */
function perOne(s: Strength): { measure: string; per: string; value: number } | null {
  const mg = MG_PER[s.unit];
  const measure = mg === undefined ? s.unit : "mg";
  const amount = s.amount * (mg ?? 1);
  const p = s.perUnit ? unitWord(s.perUnit) : "";
  if (ML_PER[p] !== undefined) return { measure, per: "ml", value: amount / ((s.perAmount ?? 1) * ML_PER[p]) };
  if (p === "" || /^\d+(\.\d+)?$/.test(p) || SOLID_UNIT.test(p)) {
    const divisor = s.perAmount ?? (p && /^\d/.test(p) ? Number(p) : 1);
    return divisor > 0 ? { measure, per: "unit", value: amount / divisor } : null;
  }
  return { measure, per: p, value: amount / (s.perAmount ?? 1) };
}

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

function sameStrength(a: Strength, b: Strength): boolean {
  const x = perOne(a);
  const y = perOne(b);
  return !!x && !!y && x.measure === y.measure && x.per === y.per && close(x.value, y.value);
}

function strengthAgreement(read: PhotoRead, f: Formulation): StrengthAgreement {
  const catalog = f.activeIngredients.map((i) => ({ name: normalizeIngredient(i.normalized || i.name), strength: i.strength }));
  let anyStrength = false;
  for (const ing of read.ingredients) {
    const name = text(ing.name);
    const candidates = name ? catalog.filter((c) => c.name === normalizeIngredient(name)) : catalog;
    if (name && candidates.length === 0) return "disagrees";
    if (!ing.strength) continue;
    anyStrength = true;
    if (!candidates.some((c) => sameStrength(ing.strength!, c.strength))) return "disagrees";
  }
  return anyStrength ? "agrees" : "not_read";
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

// Weights (higher is better):
//   ingredients  40 when the read names are exactly the label's set, else 30 × Jaccard overlap; 0 if none read
//   strength     +30 agrees, 0 not_read, −40 disagrees
//   brand        25 × Dice similarity of name tokens (read name vs brand, or vs generic name)
//   dosage form  +8 same family (liquid / solid unit / same word), −8 when both known and different
//   reviewed     +2 for a hand-checked row
// Ties break on formulation id, so the order never depends on the candidates' order.
const STRENGTH_POINTS: Record<StrengthAgreement, number> = { agrees: 30, not_read: 0, disagrees: -40 };

/** Ingredient points, and how many normalized ingredient names the read shares with the label. */
function ingredientOverlap(read: PhotoRead, f: Formulation): { points: number; shared: number } {
  const r = new Set(read.ingredients.flatMap((i) => (text(i.name) ? [normalizeIngredient(i.name!)] : [])));
  if (r.size === 0) return { points: 0, shared: 0 };
  const c = new Set(f.activeIngredients.map((i) => normalizeIngredient(i.normalized || i.name)));
  const shared = [...r].filter((n) => c.has(n)).length;
  if (shared === r.size && shared === c.size) return { points: 40, shared };
  return { points: (30 * shared) / (r.size + c.size - shared), shared };
}

/** "Children's TYLENOL" → {childrens, tylenol}. */
function tokens(name: string): Set<string> {
  const words = name.toLowerCase().replace(/['’]/g, "").split(/[^a-z0-9]+/);
  return new Set(words.filter(Boolean));
}

function dice(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const shared = [...a].filter((t) => b.has(t)).length;
  return (2 * shared) / (a.size + b.size);
}

/** Dice similarity (0..1) of the read name's tokens with the brand name, or with the generic name. */
function brandSimilarity(read: PhotoRead, f: Formulation): number {
  const name = text(read.productName);
  if (!name) return 0;
  const r = tokens(name);
  return Math.max(dice(r, tokens(f.brandName)), dice(r, tokens(f.genericName)));
}

function formFamily(form: string): string {
  const t = form.trim().toLowerCase();
  if (SOLID_UNIT.test(t)) return "solid";
  if (LIQUID_FORM.test(t)) return "liquid";
  return t;
}

function formPoints(read: PhotoRead, f: Formulation): number {
  const form = text(read.dosageForm);
  if (!form || !text(f.dosageForm)) return 0;
  return formFamily(form) === formFamily(f.dosageForm) ? 8 : -8;
}

/** Candidates ranked best first. Deduplicated by formulation id. */
export function rankCatalogMatches(read: PhotoRead, candidates: Formulation[]): CatalogMatch[] {
  const unique = new Map<string, Formulation>();
  for (const f of candidates) if (!unique.has(f.id)) unique.set(f.id, f);
  return [...unique.values()]
    .map((formulation) => {
      const agreement = strengthAgreement(read, formulation);
      const ingredients = ingredientOverlap(read, formulation);
      const brand = brandSimilarity(read, formulation);
      const score =
        ingredients.points +
        STRENGTH_POINTS[agreement] +
        25 * brand +
        formPoints(read, formulation) +
        (formulation.reviewed ? 2 : 0);
      return { formulation, strengthAgreement: agreement, score, related: ingredients.shared > 0 || brand >= 0.5 };
    })
    .sort((a, b) => b.score - a.score || (a.formulation.id < b.formulation.id ? -1 : a.formulation.id > b.formulation.id ? 1 : 0));
}

/**
 * The match to pre-select: the best-ranked one whose strengthAgreement is not "disagrees" and that is
 * `related` to the read, or null (the picker then starts with nothing selected).
 */
export function preselectMatch(matches: CatalogMatch[]): CatalogMatch | null {
  return matches.find((m) => m.strengthAgreement !== "disagrees" && m.related) ?? null;
}
