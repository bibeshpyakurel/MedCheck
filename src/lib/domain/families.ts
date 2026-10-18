// Ingredient families: different active ingredients that labels warn about as one group ("other
// NSAIDs", "any other sleep-aid"). A fixed, reviewed list; members are normalizeIngredient() outputs
// that occur in the catalog. MedCheck only reports a family when a label's own warning names it, so
// each family also says how labels name it in a warning (`labelTerm`), checked against the catalog's
// Drug Facts text: a bare purpose line ("Antihistamine") or an allergy note ("an antihistamine
// containing hydroxyzine") is not a warning about taking two of them, so those terms ask for "other".
// When unsure whether an ingredient belongs, it is left out (meclizine, dimenhydrinate: labels call
// them antiemetics, never antihistamines; bismuth subsalicylate: labels never call it an NSAID).

export type FamilyId = "nsaid" | "antihistamine" | "nasal_decongestant" | "acid_reducer" | "sleep_aid";

export type IngredientFamily = {
  id: FamilyId;
  /** Plural, as a sentence says it: "Ibuprofen and naproxen are both NSAIDs". */
  name: string;
  /** normalizeIngredient() outputs. */
  ingredients: readonly string[];
  /** How a label's warning names the family. */
  labelTerm: RegExp;
};

export const FAMILIES: readonly IngredientFamily[] = [
  {
    id: "nsaid",
    name: "NSAIDs",
    // Doan's, urinary pain relief and Texaclear labels: "This product contains an NSAID".
    ingredients: ["ibuprofen", "naproxen", "aspirin", "magnesium salicylate", "sodium salicylate", "choline salicylate"],
    labelTerm: /\bNSAIDs?\b/i,
  },
  {
    id: "antihistamine",
    name: "antihistamines",
    ingredients: [
      "diphenhydramine",
      "doxylamine",
      "chlorpheniramine",
      "dexchlorpheniramine",
      "brompheniramine",
      "dexbrompheniramine",
      "triprolidine",
      "pheniramine",
      "pyrilamine",
      "loratadine",
      "cetirizine",
      "levocetirizine",
      "fexofenadine",
    ],
    labelTerm: /\bother antihistamines?\b|\bsuch as antihistamines\b/i,
  },
  {
    id: "nasal_decongestant",
    name: "nasal decongestants",
    ingredients: ["pseudoephedrine", "phenylephrine"],
    labelTerm: /\bother (oral )?nasal decongestants?\b/i,
  },
  {
    id: "acid_reducer",
    name: "acid reducers",
    ingredients: ["famotidine", "cimetidine", "ranitidine", "omeprazole", "esomeprazole", "lansoprazole"],
    labelTerm: /\bother acid reducers?\b/i,
  },
  {
    id: "sleep_aid",
    name: "sleep aids",
    ingredients: ["diphenhydramine", "doxylamine"],
    labelTerm: /\bother sleep[- ]?aids?\b/i,
  },
];

/** The families a normalized ingredient belongs to, in FAMILIES order. */
export function familiesOf(normalizedIngredient: string): IngredientFamily[] {
  return FAMILIES.filter((f) => f.ingredients.includes(normalizedIngredient));
}
