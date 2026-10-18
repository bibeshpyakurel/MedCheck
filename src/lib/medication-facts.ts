// The medicine dashboard's content (spec: 2026-10-18-medication-dashboard-design.md): the FDA label's
// own words, arranged into the card's sections. Pure; client-safe. Every piece of label text is a
// LabelLine pointing at the raw bullet it came from; nothing is reworded, summarized or computed. The
// rules here only decide where a bullet goes, and a bullet no rule places stays where the label put it.
import { formatStrength } from "@/lib/domain/fields";
import type { Formulation, LabelSectionKey, SourceLink } from "@/lib/domain/schema";

export type LabelSource = LabelSectionKey | "directions_text" | "max_24h_text" | "warnings_quotes";
/** Which raw field, and which bullet of it, a line came from. */
export type LabelRef = { source: LabelSource; index: number };
/** Label words, verbatim: a whole bullet, or (Uses) a piece of one. `marks` are character ranges to highlight. */
export type LabelLine = { text: string; ref: LabelRef; marks?: [number, number][] };

export type StatusKind = "fictional" | "hand_checked" | "fda_published";

export const STATUS_TEXT: Record<StatusKind, string> = {
  fictional: "Fictional demo label, not a real product",
  hand_checked: "Hand-checked against the FDA label",
  fda_published: "FDA-published label · not hand-checked",
};

export type MedicationFacts = {
  header: { name: string; ingredients: string[]; labeler: string | null; labelDate: string | null; dosageForm: string; status: StatusKind };
  hero: { ingredients: { name: string; amount: string; per: string | null }[]; purposes: LabelLine[] };
  source: { kind: Formulation["source"]; setId: string | null; ndcs: string[]; links: SourceLink[] };
};

const hasText = (s: string) => s.trim() !== "";
const line = (text: string, source: LabelSource, index: number): LabelLine => ({ text, ref: { source, index } });

/** The raw text a ref points at, or null when it points nowhere. */
export function resolveRef(f: Formulation, ref: LabelRef): string | null {
  switch (ref.source) {
    case "directions_text":
      return f.directionsText;
    case "max_24h_text":
      return f.max24hText;
    case "warnings_quotes":
      return f.warningsQuotes[ref.index] ?? null;
    default:
      return f.labelSections[ref.source]?.[ref.index] ?? null;
  }
}

/** A section's bullets as lines; blank bullets are skipped but indexes still point at the raw array. */
function sectionLines(f: Formulation, key: LabelSectionKey): LabelLine[] {
  return (f.labelSections[key] ?? []).flatMap((b, i) => (hasText(b) ? [line(b.trim(), key, i)] : []));
}

function statusOf(f: Formulation): StatusKind {
  if (f.isFictional) return "fictional";
  return f.reviewed ? "hand_checked" : "fda_published";
}

function hero(f: Formulation): MedicationFacts["hero"] {
  return {
    ingredients: f.activeIngredients.map((i) => {
      const amount = formatStrength({ ...i.strength, perUnit: null });
      const full = formatStrength(i.strength);
      return { name: i.name, amount, per: full.length > amount.length ? full.slice(amount.length).trim() : null };
    }),
    purposes: sectionLines(f, "purpose"),
  };
}

export function medicationFacts(f: Formulation): MedicationFacts {
  return {
    header: {
      name: f.brandName,
      ingredients: f.activeIngredients.map((i) => `${i.name} ${formatStrength(i.strength)}`),
      labeler: f.labelerName,
      labelDate: f.labelEffectiveDate,
      dosageForm: f.dosageForm,
      status: statusOf(f),
    },
    hero: hero(f),
    source: { kind: f.source, setId: f.openfdaSetId, ndcs: f.ndcPackages, links: f.sourceLinks },
  };
}
