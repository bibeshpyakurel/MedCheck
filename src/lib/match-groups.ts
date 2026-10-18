// Catalog matches as distinct products. Pure; safe on client and server. The catalog often holds the
// same product many times (store brands, relabelers, one row per package size); the picker offers one
// choice per product. Arithmetic here is internal, for comparing strengths only — never displayed.
import type { CatalogMatch } from "@/lib/catalog-match";
import { normalizeIngredient } from "@/lib/domain/ingredients";
import type { Formulation, Strength } from "@/lib/domain/schema";

// Words naming the form or joining names: "Advil Liqui-Gels" is Advil (the dosage form says capsule),
// "Cold + Flu" is "Cold plus Flu". Strength and version words (Extra Strength, PM, 8 HR, Children's) stay.
const IGNORED_WORDS = new Set([
  "tablet", "tablets", "caplet", "caplets", "capsule", "capsules", "softgel", "softgels", "soft",
  "gelcap", "gelcaps", "geltab", "geltabs", "gel", "gels", "liqui", "liquigel", "liquigels", "liquicap",
  "liquicaps", "liquid", "chewable", "chewables", "chews", "suspension", "oral", "coated", "film",
  "and", "plus", "with",
]);

/** "Children's TYLENOL Oral Suspension" → "childrens tylenol": case, punctuation, order and form words ignored. */
function brandKey(name: string): string {
  const words = name.toLowerCase().replace(/['’]/g, "").split(/[^a-z0-9]+/);
  return [...new Set(words.filter((w) => w && !IGNORED_WORDS.has(w)))].sort().join(" ");
}

const MG_PER: Record<string, number> = { mg: 1, mcg: 0.001, g: 1000 };
const ML_PER: Record<string, number> = { ml: 1, l: 1000 };

/** A strength as "what per what = how much per one": 160 mg per 5 mL and 32 mg per 1 mL are the same. */
function strengthKey(s: Strength): string {
  const mg = MG_PER[s.unit.toLowerCase()];
  const measure = mg === undefined ? s.unit.toLowerCase() : "mg";
  const amount = s.amount * (mg ?? 1);
  const per = s.perUnit?.trim().toLowerCase().replace(/s$/, "") ?? "";
  // Every solid unit word (tablet, caplet, "1") is one unit; the dosage form already tells them apart.
  const liquid = ML_PER[per];
  const value = liquid === undefined ? amount / (s.perAmount ?? 1) : amount / ((s.perAmount ?? 1) * liquid);
  return `${measure}/${liquid === undefined ? "unit" : "ml"}=${Number(value.toPrecision(6))}`;
}

/** One product: brand (as above), ingredient set with strengths, dosage form. The labeler doesn't count. */
function productKey(f: Formulation): string {
  const ingredients = f.activeIngredients
    .map((i) => `${normalizeIngredient(i.normalized || i.name)}@${strengthKey(i.strength)}`)
    .sort()
    .join("+");
  return [brandKey(f.brandName), ingredients, f.dosageForm.trim().toLowerCase()].join("|");
}

/**
 * The matches with rows of the same product collapsed into the best-ranked one, in rank order:
 * same brand name (ignoring case, punctuation, word order and form words), same normalized
 * ingredients with the same strengths, same dosage form. Different versions and brands stay apart.
 */
export function distinctMatches(matches: CatalogMatch[]): CatalogMatch[] {
  const seen = new Set<string>();
  return matches.filter((m) => {
    const key = productKey(m.formulation);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
