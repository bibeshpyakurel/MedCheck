// Ingredient families: different active ingredients that labels warn about as one group ("other
// NSAIDs", "any other sleep-aid"). A fixed, reviewed list; members are normalizeIngredient() outputs
// that occur in the catalog. MedCheck reports a family only on the labels' own words, of two kinds:
// - a label's warning names it (`labelTerm`): an allergy note ("an antihistamine containing
//   hydroxyzine") is not a warning about taking two of them, so those terms ask for "other";
// - each product's own label puts its ingredient in the family (`ownTerm`): its Purpose line
//   ("Antihistamine", "Nighttime sleep-aid"), or for NSAIDs "(NSAID)" / "nonsteroidal
//   anti-inflammatory drug" anywhere on it. Terms checked against the catalog's Drug Facts text.
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
  /** How a label says its own ingredient is in the family: in its Purpose line, or (`anywhere`) in any section. */
  ownTerm: { pattern: RegExp; anywhere: boolean };
};

/** A Purpose line naming the family, alone or among other purposes ("Pain reliever Diuretic Antihistamine"). */
const purpose = (pattern: RegExp) => ({ pattern, anywhere: false });

export const FAMILIES: readonly IngredientFamily[] = [
  {
    id: "nsaid",
    name: "NSAIDs",
    // Doan's, urinary pain relief and Texaclear labels: "This product contains an NSAID".
    ingredients: ["ibuprofen", "naproxen", "aspirin", "magnesium salicylate", "sodium salicylate", "choline salicylate"],
    labelTerm: /\bNSAIDs?\b/i,
    // Advil "Pain reliever/fever reducer (NSAID)*" over "*nonsteroidal anti-inflammatory drug"; Aleve PM
    // "nonsteroidal anti-inflammatory drug Pain reliever"; "contains a nonsteroidal anti-inflammatory drug (NSAID)".
    ownTerm: { pattern: /\(\s*\*?\s*NSAIDs?\s*\*?\s*\)|\bnon-?\s?steroidal anti-?inflammatory\b/i, anywhere: true },
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
    ownTerm: purpose(/\bantihistamines?\b/i),
  },
  {
    id: "nasal_decongestant",
    name: "nasal decongestants",
    ingredients: ["pseudoephedrine", "phenylephrine"],
    labelTerm: /\bother (oral )?nasal decongestants?\b/i,
    ownTerm: purpose(/\bnasal decongestants?\b/i),
  },
  {
    id: "acid_reducer",
    name: "acid reducers",
    ingredients: ["famotidine", "cimetidine", "ranitidine", "omeprazole", "esomeprazole", "lansoprazole"],
    labelTerm: /\bother acid reducers?\b/i,
    ownTerm: purpose(/\bacid reducers?\b/i),
  },
  {
    id: "sleep_aid",
    name: "sleep aids",
    ingredients: ["diphenhydramine", "doxylamine"],
    labelTerm: /\bother sleep[- ]?aids?\b/i,
    // "Nighttime sleep-aid", "Nighttime sleep aid", "Night time sleep aid".
    ownTerm: purpose(/\bsleep[- ]?aids?\b/i),
  },
];

/** The families a normalized ingredient belongs to, in FAMILIES order. */
export function familiesOf(normalizedIngredient: string): IngredientFamily[] {
  return FAMILIES.filter((f) => f.ingredients.includes(normalizedIngredient));
}
