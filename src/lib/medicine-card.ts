// What the medicine card shows, section by section. Pure; client-safe. The bullets are the label's own
// words (split by the import, never reworded); only the headings are ours.
import { formatStrength } from "@/lib/domain/fields";
import type { Formulation, LabelSectionKey } from "@/lib/domain/schema";

/** A label section, or one the card builds: "purpose" is folded into "active_ingredients". */
export type CardSectionKey = Exclude<LabelSectionKey, "purpose"> | "active_ingredients" | "max_24h";

export type CardSection = { key: CardSectionKey; heading: string; bullets: string[] };

/** Card order, with plain-language headings. */
const SECTIONS: [CardSectionKey, string][] = [
  ["uses", "What it's for"],
  ["active_ingredients", "Active ingredients"],
  ["directions", "How to take it"],
  ["max_24h", "24-hour limit"],
  ["do_not_use", "Don't use if"],
  ["ask_doctor", "Ask a doctor first if"],
  ["ask_doctor_or_pharmacist", "Taking other medicines?"],
  ["when_using", "While using it"],
  ["stop_use", "Stop and ask a doctor if"],
  ["pregnancy_or_breast_feeding", "Pregnant or breastfeeding"],
  ["warnings", "Other warnings"],
  ["keep_out_of_reach", "Keep out of reach of children"],
  ["inactive_ingredients", "Inactive ingredients (allergies)"],
  ["storage", "Storage"],
];

const hasText = (s: string) => s.trim() !== "";

/**
 * The card's sections in order, only those with content. Rows imported before `labelSections` existed
 * fall back to `directionsText` and `warningsQuotes`. "How to take it" is kept when the dosing table is
 * its only content, so the table always has a home.
 */
export function cardSections(f: Formulation): CardSection[] {
  const labelled = (key: LabelSectionKey) => (f.labelSections[key] ?? []).filter(hasText);
  const hasLabelSections = Object.values(f.labelSections).some((bullets) => bullets?.some(hasText));
  const line = (text: string | null) => (text && hasText(text) ? [text] : []);

  const bulletsFor = (key: CardSectionKey): string[] => {
    switch (key) {
      case "active_ingredients":
        // Purposes stay their own lines: the label doesn't say which purpose belongs to which ingredient.
        if (f.activeIngredients.length === 0) return [];
        return [...f.activeIngredients.map((i) => `${i.name} ${formatStrength(i.strength)}`), ...labelled("purpose")];
      case "directions": {
        const directions = labelled("directions");
        return directions.length > 0 ? directions : line(f.directionsText);
      }
      case "max_24h":
        return line(f.max24hText);
      case "warnings":
        // warningsQuotes are excerpts of the named sections; use them only when those are missing.
        return hasLabelSections ? labelled("warnings") : f.warningsQuotes.filter(hasText);
      default:
        return labelled(key);
    }
  };

  return SECTIONS.flatMap(([key, heading]) => {
    const bullets = bulletsFor(key);
    const keep = bullets.length > 0 || (key === "directions" && Boolean(f.dosageTableHtml));
    return keep ? [{ key, heading, bullets }] : [];
  });
}
