// The comparison of the medicines in one photo: which active ingredients they share and which belong
// to one family, each backed by the label's own words. Pure. Evidence, not advice: it never says a
// combination is safe and does no dose math. Ingredients are compared by their normalizeIngredient()
// name (catalog rows carry it as `activeIngredients[].normalized`).
import { FAMILIES, type FamilyId, type IngredientFamily } from "@/lib/domain/families";
import { formatStrength } from "@/lib/domain/fields";
import { LABEL_SECTION_KEYS, type Formulation, type LabelSectionKey } from "@/lib/domain/schema";
import { LABEL_HEADINGS } from "@/lib/quick-answers";

export type ComparedProduct = Pick<Formulation, "id" | "brandName" | "activeIngredients" | "labelSections" | "warningsQuotes">;

/** One product's own label line putting its ingredient in a family, under its Drug Facts heading. */
export type OwnLabelWords<P = string> = { product: P; heading: string; quote: string };

/**
 * Why two ingredients are reported as one family, in the labels' own words: a label's warning naming
 * the family (preferred), else each product's own label (Purpose line, NSAID footnote).
 */
export type FamilyEvidence<P = string> = { kind: "warning"; quote: string } | { kind: "own_labels"; quotes: OwnLabelWords<P>[] };

export type ProductComparison = {
  products: { id: string; name: string }[];
  /** One row per ingredient: strength text per product (in `products` order) or null. Shared rows first, then input order. */
  ingredients: { normalized: string; displayName: string; perProduct: (string | null)[] }[];
  /** Ingredients in two or more products. */
  shared: { normalized: string; displayName: string; productIds: string[]; labelQuote: string | null }[];
  /** Different ingredients of one family in different products, in the labels' own words. */
  families: {
    familyId: FamilyId;
    name: string;
    members: { normalized: string; displayName: string; productId: string }[];
    /** `quotes[].product` is the product's id. */
    evidence: FamilyEvidence;
  }[];
};

/** Where labels warn, in the order they are searched; then `warningsQuotes`. */
const WARNING_SECTIONS: readonly LabelSectionKey[] = ["do_not_use", "ask_doctor_or_pharmacist", "warnings", "when_using", "ask_doctor", "stop_use"];

function warningBullets(p: ComparedProduct): string[] {
  return [...WARNING_SECTIONS.flatMap((s) => p.labelSections[s] ?? []), ...p.warningsQuotes];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const OTHER_CONTAINING = /\bother\b[^.]*\bcontaining\b/i;
// "Do not use with any other drug containing …" as one sentence; not a run-on of several bullets
// ("Do not use to make a child sleepy with any other product containing diphenhydramine").
const DO_NOT_USE_OTHER = /\bdo not use with (any )?other\b[^.]*\bcontaining\b/i;

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
function familyQuote(products: ComparedProduct[], labelTerm: RegExp): string | null {
  const bullets = products.flatMap(warningBullets).filter((b) => labelTerm.test(b));
  return firstByPreference(bullets, [(b) => /\bother\b/i.test(b), () => true]);
}

type Member = { product: unknown; normalized: string };

/** Two different ingredients in two different products. */
const isFamilyPair = (members: Member[]) => members.some((a) => members.some((b) => a.product !== b.product && a.normalized !== b.normalized));

const HEADING_ORDER: readonly LabelSectionKey[] = ["purpose", ...LABEL_SECTION_KEYS.filter((k) => k !== "purpose")];

/**
 * The line on a product's own label saying its ingredient `normalized` is in the family: a Purpose line
 * naming the family, or for NSAIDs "(NSAID)" / "nonsteroidal anti-inflammatory" anywhere (Purpose
 * first). A label's purposes aren't tied to its ingredients, so this holds only when `normalized` is the
 * label's one ingredient of that family.
 */
function ownLabelWords(label: ComparedProduct, family: IngredientFamily, normalized: string): { heading: string; quote: string } | null {
  const inFamily = new Set(label.activeIngredients.map((i) => i.normalized).filter((n) => family.ingredients.includes(n)));
  if (inFamily.size !== 1 || !inFamily.has(normalized)) return null;
  for (const key of family.ownTerm.anywhere ? HEADING_ORDER : (["purpose"] as const)) {
    const quote = label.labelSections[key]?.find((b) => family.ownTerm.pattern.test(b));
    if (quote !== undefined) return { heading: LABEL_HEADINGS[key] ?? "Drug Facts", quote };
  }
  return null;
}

/**
 * The evidence that `members` (ingredients of `family`, per product) belong together, in the labels' own
 * words: a warning on any of their labels naming the family; else, per product, its own label putting
 * its ingredient in the family — members whose label doesn't (or that have no catalog label) are
 * dropped. `labelOf` gives a product's catalog label, or null.
 */
function familyEvidence<T extends Member>(
  family: IngredientFamily,
  members: T[],
  labelOf: (product: T["product"]) => ComparedProduct | null,
): { members: T[]; evidence: FamilyEvidence<T["product"]> } | null {
  const products = [...new Set(members.map((m) => m.product))];
  const labels = products.flatMap((p) => labelOf(p) ?? []);
  const quote = familyQuote(labels, family.labelTerm);
  if (quote !== null) return { members, evidence: { kind: "warning", quote } };

  const quotes: OwnLabelWords<T["product"]>[] = [];
  const kept = members.filter((m) => {
    const label = labelOf(m.product);
    const words = label && ownLabelWords(label, family, m.normalized);
    if (!words) return false;
    if (!quotes.some((q) => q.product === m.product)) quotes.push({ product: m.product, ...words });
    return true;
  });
  return isFamilyPair(kept) ? { members: kept, evidence: { kind: "own_labels", quotes } } : null;
}

/**
 * The families holding two different ingredients in two different products, each with its
 * `familyEvidence` (which may keep fewer members); a family without any is left out. One note per set
 * of ingredients: diphenhydramine and doxylamine are both antihistamines and sleep aids. `members`
 * keep the input order.
 */
export function matchFamilies<T extends Member>(
  items: T[],
  labelOf: (product: T["product"]) => ComparedProduct | null,
): { family: IngredientFamily; members: T[]; evidence: FamilyEvidence<T["product"]> }[] {
  const found: { family: IngredientFamily; members: T[]; evidence: FamilyEvidence<T["product"]> }[] = [];
  const seenSets = new Set<string>();
  for (const family of FAMILIES) {
    const members = items.filter((i) => family.ingredients.includes(i.normalized));
    if (!isFamilyPair(members)) continue;
    const hit = familyEvidence(family, members, labelOf);
    if (!hit) continue;
    const set = [...new Set(hit.members.map((m) => m.normalized))].sort().join("+");
    if (seenSets.has(set)) continue;
    seenSets.add(set);
    found.push({ family, ...hit });
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
  const byId = new Map(products.map((p) => [p.id, p]));
  const families = matchFamilies(items, (id) => byId.get(id) ?? null).map(
    ({ family, members, evidence }) => ({
      familyId: family.id,
      name: family.name,
      members: members.map((m) => ({ normalized: m.normalized, displayName: rows.get(m.normalized)!.displayName, productId: m.product })),
      evidence,
    }),
  );

  const ordered = [...sharedRows, ...all.filter((r) => r.productIds.length < 2)];
  return {
    products: products.map((p) => ({ id: p.id, name: p.brandName })),
    ingredients: ordered.map(({ normalized, displayName, perProduct }) => ({ normalized, displayName, perProduct })),
    shared,
    families,
  };
}
