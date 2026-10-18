// The comparison of the medicines in one photo: which active ingredients they share and which belong
// to one family, each backed by the label's own words. Pure. Evidence, not advice: it never says a
// combination is safe and does no dose math. Ingredients are compared by their normalizeIngredient()
// name (catalog rows carry it as `activeIngredients[].normalized`).
import { FAMILIES, type FamilyId, type IngredientFamily } from "@/lib/domain/families";
import { formatStrength } from "@/lib/domain/fields";
import type { Formulation, LabelSectionKey } from "@/lib/domain/schema";

export type ComparedProduct = Pick<Formulation, "id" | "brandName" | "activeIngredients" | "labelSections" | "warningsQuotes">;

export type ProductComparison = {
  products: { id: string; name: string }[];
  /** One row per ingredient: strength text per product (in `products` order) or null. Shared rows first, then input order. */
  ingredients: { normalized: string; displayName: string; perProduct: (string | null)[] }[];
  /** Ingredients in two or more products. */
  shared: { normalized: string; displayName: string; productIds: string[]; labelQuote: string | null }[];
  /** Different ingredients of one family in different products, named by a label's own warning. */
  families: { familyId: FamilyId; name: string; members: { normalized: string; displayName: string; productId: string }[]; labelQuote: string }[];
};

/** Where labels warn, in the order they are searched; then `warningsQuotes`. */
const WARNING_SECTIONS: readonly LabelSectionKey[] = ["do_not_use", "ask_doctor_or_pharmacist", "warnings", "when_using", "ask_doctor", "stop_use"];

function warningBullets(p: ComparedProduct): string[] {
  return [...WARNING_SECTIONS.flatMap((s) => p.labelSections[s] ?? []), ...p.warningsQuotes];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const OTHER_CONTAINING = /\bother\b[^.]*\bcontaining\b/i;
const DO_NOT_USE_OTHER = /\bdo not use\b[^.]*\bother\b[^.]*\bcontaining\b/i;

/** The first bullet passing the earliest test that any bullet passes. */
function firstByPreference(bullets: string[], tests: ((b: string) => boolean)[]): string | null {
  for (const test of tests) {
    const hit = bullets.find(test);
    if (hit !== undefined) return hit;
  }
  return null;
}

/**
 * The label's own line about an ingredient, across the products: the whole "Do not use with any other
 * drug containing …" sentence, else any "other … containing" bullet naming it, else the first bullet
 * that mentions it.
 */
function ingredientQuote(products: ComparedProduct[], normalized: string): string | null {
  const mentions = new RegExp(`\\b${escape(normalized)}\\b`, "i");
  const bullets = products.flatMap(warningBullets).filter((b) => mentions.test(b));
  return firstByPreference(bullets, [(b) => DO_NOT_USE_OTHER.test(b), (b) => OTHER_CONTAINING.test(b), () => true]);
}

/** A label line naming the family, preferring one about "other" drugs of it. */
export function familyQuote(products: ComparedProduct[], labelTerm: RegExp): string | null {
  const bullets = products.flatMap(warningBullets).filter((b) => labelTerm.test(b));
  return firstByPreference(bullets, [(b) => /\bother\b/i.test(b), () => true]);
}

/**
 * The families holding two different ingredients in two different products, each with a label line
 * from `quote`; a family without one is left out. One note per set of ingredients: diphenhydramine
 * and doxylamine are both antihistamines and sleep aids. `members` keep the input order.
 */
export function matchFamilies<T extends { product: unknown; normalized: string }>(
  items: T[],
  quote: (family: IngredientFamily, members: T[]) => string | null,
): { family: IngredientFamily; members: T[]; labelQuote: string }[] {
  const found: { family: IngredientFamily; members: T[]; labelQuote: string }[] = [];
  const seenSets = new Set<string>();
  for (const family of FAMILIES) {
    const members = items.filter((i) => family.ingredients.includes(i.normalized));
    if (!members.some((a) => members.some((b) => a.product !== b.product && a.normalized !== b.normalized))) continue;
    const set = [...new Set(members.map((m) => m.normalized))].sort().join("+");
    if (seenSets.has(set)) continue;
    const labelQuote = quote(family, members);
    if (labelQuote === null) continue;
    seenSets.add(set);
    found.push({ family, members, labelQuote });
  }
  return found;
}

export function compareProducts(input: ComparedProduct[]): ProductComparison {
  // The same product twice is one product.
  const products = input.filter((p, i) => input.findIndex((q) => q.id === p.id) === i);

  type Row = { normalized: string; displayName: string; perProduct: (string | null)[]; productIds: string[] };
  const rows = new Map<string, Row>();
  products.forEach((p, column) => {
    for (const ing of p.activeIngredients) {
      const row = rows.get(ing.normalized) ?? { normalized: ing.normalized, displayName: ing.name, perProduct: products.map(() => null), productIds: [] };
      if (row.perProduct[column] !== null) continue;
      row.perProduct[column] = formatStrength(ing.strength);
      row.productIds.push(p.id);
      rows.set(ing.normalized, row);
    }
  });

  const all = [...rows.values()];
  const sharedRows = all.filter((r) => r.productIds.length >= 2);
  const shared = sharedRows.map((r) => ({
    normalized: r.normalized,
    displayName: r.displayName,
    productIds: r.productIds,
    labelQuote: ingredientQuote(
      products.filter((p) => r.productIds.includes(p.id)),
      r.normalized,
    ),
  }));

  const items = products.flatMap((p) => p.activeIngredients.map((i) => ({ product: p.id, normalized: i.normalized })));
  const families = matchFamilies(items, (family, members) =>
    familyQuote(
      products.filter((p) => members.some((m) => m.product === p.id)),
      family.labelTerm,
    ),
  ).map(({ family, members, labelQuote }) => ({
    familyId: family.id,
    name: family.name,
    members: members.map((m) => ({ normalized: m.normalized, displayName: rows.get(m.normalized)!.displayName, productId: m.product })),
    labelQuote,
  }));

  const ordered = [...sharedRows, ...all.filter((r) => r.productIds.length < 2)];
  return {
    products: products.map((p) => ({ id: p.id, name: p.brandName })),
    ingredients: ordered.map(({ normalized, displayName, perProduct }) => ({ normalized, displayName, perProduct })),
    shared,
    families,
  };
}
