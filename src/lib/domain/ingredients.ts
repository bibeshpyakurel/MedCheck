// Canonical ingredient names. Labels and documents spell the same ingredient many ways;
// every comparison goes through normalizeIngredient().

const SYNONYMS: Record<string, string> = {
  acetaminophen: "acetaminophen",
  paracetamol: "acetaminophen",
  apap: "acetaminophen",
  "n-acetyl-p-aminophenol": "acetaminophen",
  dextromethorphan: "dextromethorphan",
  "dextromethorphan hbr": "dextromethorphan",
  "dextromethorphan hydrobromide": "dextromethorphan",
  doxylamine: "doxylamine",
  "doxylamine succinate": "doxylamine",
  phenylephrine: "phenylephrine",
  "phenylephrine hcl": "phenylephrine",
  "phenylephrine hydrochloride": "phenylephrine",
  guaifenesin: "guaifenesin",
  diphenhydramine: "diphenhydramine",
  "diphenhydramine hcl": "diphenhydramine",
  "diphenhydramine hydrochloride": "diphenhydramine",
  ibuprofen: "ibuprofen",
  aspirin: "aspirin",
  "calcium carbonate": "calcium carbonate",
};

/** "Acetaminophen (as APAP) 325 mg" → "acetaminophen". Unknown names are lowercased and trimmed. */
export function normalizeIngredient(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/\(.*?\)/g, " ") // drop parentheticals like "(as ...)" or "(in each 5 mL)"
    .replace(/\d+(\.\d+)?\s*(mg|mcg|g|ml)\b.*$/i, " ") // drop a trailing strength
    .replace(/[^a-z\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (SYNONYMS[cleaned]) return SYNONYMS[cleaned];
  // Try the leading words, so "acetaminophen usp" or "doxylamine succinate tablets" still match.
  const words = cleaned.split(" ");
  for (let n = words.length - 1; n >= 1; n--) {
    const prefix = words.slice(0, n).join(" ");
    if (SYNONYMS[prefix]) return SYNONYMS[prefix];
  }
  return cleaned;
}
