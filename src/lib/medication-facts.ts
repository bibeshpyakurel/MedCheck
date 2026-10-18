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

export type UseIcon = "zap" | "thermometer" | "snowflake" | "wind" | "moon" | "flame" | "activity" | "dot";
export type UseTile = LabelLine & { icon: UseIcon };
/** `lead` is the label's words before its list ("temporarily relieves minor aches and pains due to:"). */
export type UseGroup = { lead: LabelLine | null; tiles: UseTile[] };

export type MedicationFacts = {
  header: { name: string; ingredients: string[]; labeler: string | null; labelDate: string | null; dosageForm: string; status: StatusKind };
  hero: { ingredients: { name: string; amount: string; per: string | null }[]; purposes: LabelLine[] };
  uses: UseGroup[];
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

// ---------------------------------------------------------------------------------------------
// Uses

/** Decorative icons by the tile's own words; first match wins, anything else is a neutral dot. */
const USE_ICONS: [RegExp, UseIcon][] = [
  [/headache/i, "zap"],
  [/\bfever\b/i, "thermometer"],
  [/\bcold\b|\bflu\b/i, "snowflake"],
  [/sneez|runny nose|itch|watery eyes|nasal|congestion/i, "wind"],
  [/sleep/i, "moon"],
  [/heartburn|\bacid\b|indigestion|stomach/i, "flame"],
  [/ache|\bpain|arthritis|cramps/i, "activity"],
];

/** A Uses bullet that opens a new statement rather than continuing a list. */
const USE_VERB = /^(?:temporarily|relieves|reduces|helps|prevents|controls|for)\b/i;
const LIST_GLYPH = /^[-•·*]\s*/;
const firstWord = (s: string) => (s.trim().split(/\s+/)[0] ?? "").toLowerCase().replace(/[^a-z]/g, "");

function useIcon(text: string): UseIcon {
  return USE_ICONS.find(([re]) => re.test(text))?.[1] ?? "dot";
}

const useTile = (text: string, index: number): UseTile => ({ ...line(text, "uses", index), icon: useIcon(text) });

/**
 * A bullet with a colon starts a list: the words up to the colon are its lead, the rest its first tile.
 * Following colon-less bullets join the list, unless they open a statement of their own (the lead's
 * first word, or a Uses verb: "temporarily reduces fever"), which stands alone.
 */
function useGroups(f: Formulation): UseGroup[] {
  const groups: UseGroup[] = [];
  let open: { group: UseGroup; leadWord: string } | null = null;
  for (const [index, raw] of (f.labelSections.uses ?? []).entries()) {
    const colon = raw.indexOf(":");
    if (colon > 0) {
      const lead = raw.slice(0, colon + 1).trim();
      const rest = raw.slice(colon + 1).trim().replace(LIST_GLYPH, "");
      const group: UseGroup = { lead: line(lead, "uses", index), tiles: rest ? [useTile(rest, index)] : [] };
      groups.push(group);
      open = { group, leadWord: firstWord(lead) };
      continue;
    }
    const text = raw.trim().replace(LIST_GLYPH, "");
    if (!text) continue;
    if (open && firstWord(text) !== open.leadWord && !USE_VERB.test(text)) {
      open.group.tiles.push(useTile(text, index));
      continue;
    }
    open = null;
    const last = groups.at(-1);
    if (last && last.lead === null) last.tiles.push(useTile(text, index));
    else groups.push({ lead: null, tiles: [useTile(text, index)] });
  }
  return groups;
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
    uses: useGroups(f),
    source: { kind: f.source, setId: f.openfdaSetId, ndcs: f.ndcPackages, links: f.sourceLinks },
  };
}
