// Canonical ingredient names. Labels and documents spell the same ingredient many ways;
// every comparison goes through normalizeIngredient().
//
// A reviewed, fixed table (no RxNorm or other service). Salt, ester, hydrate and USP spellings of
// one active moiety map to its base name ("naproxen sodium" → "naproxen"). Where the salt *is* the
// ingredient ("docusate sodium", "magnesium hydroxide") the full name is kept. When unsure, a name
// is left out: a missed synonym is safer than merging two different drugs. Never add a bare element
// ("calcium", "magnesium", "sodium", "zinc"): the leading-words match would swallow its salts.
// Names are matched after cleaning: lowercase, no digits or punctuation, HCI read as HCl, and a
// trailing USP/NF or FDA's "unspecified (form)" dropped.

const SYNONYMS: Record<string, string> = {
  // Pain and fever
  acetaminophen: "acetaminophen",
  paracetamol: "acetaminophen",
  apap: "acetaminophen",
  "n-acetyl-p-aminophenol": "acetaminophen",
  ibuprofen: "ibuprofen",
  "ibuprofen sodium": "ibuprofen",
  "ibuprofen potassium": "ibuprofen",
  "solubilized ibuprofen": "ibuprofen",
  naproxen: "naproxen",
  "naproxen sodium": "naproxen",
  aspirin: "aspirin",
  "acetylsalicylic acid": "aspirin",

  // Cough and cold
  dextromethorphan: "dextromethorphan",
  "dextromethorphan hbr": "dextromethorphan",
  "dextromethorphan hydrobromide": "dextromethorphan",
  "dextromethorphan hydrochloride": "dextromethorphan",
  "dextromethorphan polistirex": "dextromethorphan",
  guaifenesin: "guaifenesin",
  guaiphenesin: "guaifenesin",
  codeine: "codeine",
  "codeine phosphate": "codeine",
  chlophedianol: "chlophedianol",
  "chlophedianol hcl": "chlophedianol",
  "chlophedianol hydrochloride": "chlophedianol",
  pentoxyverine: "pentoxyverine",
  "pentoxyverine citrate": "pentoxyverine",
  carbetapentane: "pentoxyverine",
  "carbetapentane citrate": "pentoxyverine",

  // Decongestants
  phenylephrine: "phenylephrine",
  "phenylephrine hcl": "phenylephrine",
  "phenylephrine hydrochloride": "phenylephrine",
  "phenylephrine bitartrate": "phenylephrine",
  pseudoephedrine: "pseudoephedrine",
  "pseudoephedrine hcl": "pseudoephedrine",
  "pseudoephedrine hydrochloride": "pseudoephedrine",
  "pseudoephedrine sulfate": "pseudoephedrine",
  ephedrine: "ephedrine",
  "ephedrine hydrochloride": "ephedrine",
  "ephedrine sulfate": "ephedrine",

  // Antihistamines. An enantiomer (dex-, levo-) is its own ingredient. Dimenhydrinate stays itself:
  // it is a diphenhydramine salt, but labels state its strength as dimenhydrinate.
  diphenhydramine: "diphenhydramine",
  "diphenhydramine hcl": "diphenhydramine",
  "diphenhydramine hydrochloride": "diphenhydramine",
  "diphenhydramine citrate": "diphenhydramine",
  dimenhydrinate: "dimenhydrinate",
  doxylamine: "doxylamine",
  "doxylamine succinate": "doxylamine",
  cetirizine: "cetirizine",
  "cetirizine hcl": "cetirizine",
  "cetirizine hydrochloride": "cetirizine",
  "cetirizine dihydrochloride": "cetirizine",
  levocetirizine: "levocetirizine",
  "levocetirizine dihydrochloride": "levocetirizine",
  loratadine: "loratadine",
  fexofenadine: "fexofenadine",
  "fexofenadine hcl": "fexofenadine",
  "fexofenadine hydrochloride": "fexofenadine",
  chlorpheniramine: "chlorpheniramine",
  "chlorpheniramine maleate": "chlorpheniramine",
  chlorphenamine: "chlorpheniramine",
  "chlorphenamine maleate": "chlorpheniramine",
  dexchlorpheniramine: "dexchlorpheniramine",
  "dexchlorpheniramine maleate": "dexchlorpheniramine",
  brompheniramine: "brompheniramine",
  "brompheniramine maleate": "brompheniramine",
  dexbrompheniramine: "dexbrompheniramine",
  "dexbrompheniramine maleate": "dexbrompheniramine",
  pheniramine: "pheniramine",
  "pheniramine maleate": "pheniramine",
  pyrilamine: "pyrilamine",
  "pyrilamine maleate": "pyrilamine",
  mepyramine: "pyrilamine",
  "mepyramine maleate": "pyrilamine",
  triprolidine: "triprolidine",
  "triprolidine hcl": "triprolidine",
  "triprolidine hydrochloride": "triprolidine",
  chlorcyclizine: "chlorcyclizine",
  "chlorcyclizine hydrochloride": "chlorcyclizine",
  meclizine: "meclizine",
  "meclizine hcl": "meclizine",
  "meclizine hydrochloride": "meclizine",
  "meclizine dihydrochloride": "meclizine",
  meclozine: "meclizine",

  // Acid reducers
  famotidine: "famotidine",
  cimetidine: "cimetidine",
  ranitidine: "ranitidine",
  "ranitidine hydrochloride": "ranitidine",
  omeprazole: "omeprazole",
  "omeprazole magnesium": "omeprazole",
  esomeprazole: "esomeprazole",
  "esomeprazole magnesium": "esomeprazole",
  "esomeprazole magnesium dihydrate": "esomeprazole",
  "esomeprazole magnesium trihydrate": "esomeprazole",
  lansoprazole: "lansoprazole",

  // Antacids, laxatives, antidiarrheals, antigas
  loperamide: "loperamide",
  "loperamide hcl": "loperamide",
  "loperamide hydrochloride": "loperamide",
  bisacodyl: "bisacodyl",
  sennosides: "sennosides",
  "sennosides a and b": "sennosides",
  psyllium: "psyllium",
  "psyllium husk": "psyllium",
  "psyllium seed husk": "psyllium",
  "psyllium hydrophilic mucilloid": "psyllium",
  // FDA lists oral simethicone as DIMETHICONE (simethicone is dimethicone activated with silica).
  simethicone: "simethicone",
  dimethicone: "simethicone",
  "activated dimethicone": "simethicone",
  "docusate sodium": "docusate sodium",
  "dioctyl sodium sulfosuccinate": "docusate sodium",
  "docusate calcium": "docusate calcium",
  "polyethylene glycol": "polyethylene glycol", // "3350" is dropped with the other digits
  "calcium carbonate": "calcium carbonate",
  "calcium polycarbophil": "calcium polycarbophil",
  "magnesium hydroxide": "magnesium hydroxide",
  "magnesium citrate": "magnesium citrate",
  "magnesium oxide": "magnesium oxide",
  "magnesium carbonate": "magnesium carbonate",
  "magnesium sulfate": "magnesium sulfate",
  "magnesium sulfate heptahydrate": "magnesium sulfate",
  "aluminum hydroxide": "aluminum hydroxide",
  "sodium bicarbonate": "sodium bicarbonate",
  "bismuth subsalicylate": "bismuth subsalicylate",
  "citric acid": "citric acid",
  "anhydrous citric acid": "citric acid",
  "citric acid monohydrate": "citric acid",

  // Salicylates other than aspirin are their own ingredients
  "magnesium salicylate": "magnesium salicylate",
  "sodium salicylate": "sodium salicylate",
  "choline salicylate": "choline salicylate",
  "methyl salicylate": "methyl salicylate",

  // Mouth, teeth and throat
  "potassium nitrate": "potassium nitrate",
  "sodium fluoride": "sodium fluoride",
  "stannous fluoride": "stannous fluoride",
  "sodium monofluorophosphate": "sodium monofluorophosphate",
  "cetylpyridinium chloride": "cetylpyridinium chloride",
  dyclonine: "dyclonine",
  "dyclonine hydrochloride": "dyclonine",

  // Other
  nicotine: "nicotine",
  "nicotine polacrilex": "nicotine",
  phenazopyridine: "phenazopyridine",
  "phenazopyridine hydrochloride": "phenazopyridine",
  pyrantel: "pyrantel",
  "pyrantel pamoate": "pyrantel",
  pyridoxine: "pyridoxine",
  "pyridoxine hydrochloride": "pyridoxine",
};

/** "Acetaminophen (as APAP) 325 mg" → "acetaminophen". Unknown names are lowercased and trimmed. */
export function normalizeIngredient(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/\(.*?\)/g, " ") // drop parentheticals like "(as ...)" or "(in each 5 mL)"
    .replace(/\d+(\.\d+)?\s*(mg|mcg|g|ml)\b.*$/i, " ") // drop a trailing strength
    .replace(/[^a-z\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bhci\b/g, "hcl") // "HCI" (capital i) is a common misprint of HCl
    .replace(/( (usp|nf|unspecified( form)?))+$/, ""); // "Loratadine USP", FDA's "…, UNSPECIFIED FORM"
  if (SYNONYMS[cleaned]) return SYNONYMS[cleaned];
  // Try the leading words, so "acetaminophen usp" or "doxylamine succinate tablets" still match.
  const words = cleaned.split(" ");
  for (let n = words.length - 1; n >= 1; n--) {
    const prefix = words.slice(0, n).join(" ");
    if (SYNONYMS[prefix]) return SYNONYMS[prefix];
  }
  return cleaned;
}
