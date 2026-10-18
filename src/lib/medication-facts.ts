// The medicine dashboard's content (spec: 2026-10-18-medication-dashboard-design.md): the FDA label's
// own words, arranged into the card's sections. Pure; client-safe. Every piece of label text is a
// LabelLine pointing at the raw bullet it came from; nothing is reworded, summarized or computed. The
// rules here only decide where a bullet goes, and a bullet no rule places stays where the label put it.
import { formatStrength } from "@/lib/domain/fields";
import type { Formulation, LabelSectionKey, SourceLink } from "@/lib/domain/schema";
import { ageGroups, ageOf, LABEL_HEADINGS, quickAnswers, WARNING_HEAD } from "@/lib/quick-answers";

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

/** Label-order run of direction lines: general (`age` null), or one age line and the lines continuing it. */
export type DirectionSegment = { age: string | null; lines: LabelLine[] };
/** One form's directions ("Advil Caplets"); `heading` null holds lines every form shares. */
export type DirectionBlock = { heading: LabelLine | null; segments: DirectionSegment[] };
export type Directions = { blocks: DirectionBlock[]; max24h: LabelLine | null; dosageTableHtml: string | null };

/** `headed`: a named label warning ("Stomach bleeding warning"); `section`: a Drug Facts section card. */
export type WarningCard = { kind: "headed" | "section"; title: string; section: LabelSectionKey | null; lead: LabelLine | null; lines: LabelLine[] };

export type GoodToKnowKey = "alcohol" | "food" | "drowsiness" | "allergies";
/** The label's bullets mentioning the topic, or the fixed "The label doesn't mention …" line. */
export type GoodToKnowTile = { key: GoodToKnowKey; title: string; bullets: string[]; notOnLabel: string | null };

export type MedicationFacts = {
  header: { name: string; ingredients: string[]; labeler: string | null; labelDate: string | null; dosageForm: string; status: StatusKind };
  hero: { ingredients: { name: string; amount: string; per: string | null }[]; purposes: LabelLine[] };
  uses: UseGroup[];
  directions: Directions;
  warnings: WarningCard[];
  /** "Took too much?": the label's overdose lines (maybe none; Poison Control's number always shows). */
  overdose: LabelLine[];
  goodToKnow: GoodToKnowTile[];
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

function iconOf(text: string): UseIcon {
  return USE_ICONS.find(([re]) => re.test(text))?.[1] ?? "dot";
}

const tileOf = (text: string, index: number): UseTile => ({ ...line(text, "uses", index), icon: iconOf(text) });

/**
 * A bullet with a colon starts a list: the words up to the colon are its lead, the rest its first tile.
 * Following colon-less bullets join the list, unless they open a statement of their own (the lead's
 * first word, or a Uses verb: "temporarily reduces fever"), which stands alone.
 */
function usesGroups(f: Formulation): UseGroup[] {
  const groups: UseGroup[] = [];
  let open: { group: UseGroup; leadWord: string } | null = null;
  for (const [index, raw] of (f.labelSections.uses ?? []).entries()) {
    const colon = raw.indexOf(":");
    if (colon > 0) {
      const lead = raw.slice(0, colon + 1).trim();
      const rest = raw.slice(colon + 1).trim().replace(LIST_GLYPH, "");
      const group: UseGroup = { lead: line(lead, "uses", index), tiles: rest ? [tileOf(rest, index)] : [] };
      groups.push(group);
      open = { group, leadWord: firstWord(lead) };
      continue;
    }
    const text = raw.trim().replace(LIST_GLYPH, "");
    if (!text) continue;
    if (open && firstWord(text) !== open.leadWord && !USE_VERB.test(text)) {
      open.group.tiles.push(tileOf(text, index));
      continue;
    }
    open = null;
    const last = groups.at(-1);
    if (last && last.lead === null) last.tiles.push(tileOf(text, index));
    else groups.push({ lead: null, tiles: [tileOf(text, index)] });
  }
  return groups;
}

// ---------------------------------------------------------------------------------------------
// Directions

const UNIT = String.raw`(?:gel ?caplets?|caplets?|tablets?|capsules?|softgels?|liqui-?caps?|gelcaps?|chewables?|lozenges?|teaspoons?(?:ful)?|tablespoons?(?:ful)?|tsp|tbsp|mL|drops?|doses?|packets?)`;
const NUM = String.raw`(?:\d+(?:\.\d+)?|one|two|three|four|five|six)`;
const HOURS = String.raw`(?:hours?|hrs?)`;

/** Highlighted words, in priority order: a longer match keeps its range against later, shorter ones. */
const MARK_PATTERNS: RegExp[] = [
  new RegExp(String.raw`\b${NUM}\s*(?:${UNIT}|times)\s+(?:in|per|within)\s+(?:any\s+)?24\s*${HOURS}`, "gi"),
  new RegExp(String.raw`\bevery\s+\d+(?:\s*(?:to|-|–)\s*\d+)?\s*${HOURS}`, "gi"),
  new RegExp(String.raw`\b${NUM}\s*${UNIT}\b`, "gi"),
  /\b(?:ask|consult) a (?:doctor|dentist|physician)\b/gi,
];
const DAILY_LIMIT = new RegExp(String.raw`\b24\s*${HOURS}`, "i");

/** Character ranges of `text` to highlight: amounts, intervals, 24-hour limits, referrals. Sorted, disjoint. */
export function markRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  for (const re of MARK_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const start = m.index;
      const end = start + m[0].length;
      if (ranges.every(([s, e]) => end <= s || start >= e)) ranges.push([start, end]);
    }
  }
  return ranges.sort((a, b) => a[0] - b[0]);
}

/** A line about the most in 24 hours (shown with a clock). */
export function isDailyLimit(text: string): boolean {
  return DAILY_LIMIT.test(text);
}

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Advil Caplets": a short bullet opening with the brand's first word, with no number or colon. */
function isFormHeading(text: string, brandName: string): boolean {
  const brand = firstWord(brandName);
  return brand !== "" && firstWord(text) === brand && !/[\d:]/.test(text) && text.trim().split(/\s+/).length <= 5;
}

/** The age card's heading: the line's own phrase before its colon, else "Adults" / "Children". */
function ageLabel(text: string, age: "adults" | "children"): string {
  const colon = text.indexOf(":");
  if (colon > 0 && colon <= 60) return capitalize(text.slice(0, colon).trim());
  return age === "adults" ? "Adults" : "Children";
}

/** Lines in label order: each age line opens a card its continuing lines join; other lines group as general. */
function segmentsOf(lines: LabelLine[]): DirectionSegment[] {
  const groups = ageGroups(lines.map((l) => l.text));
  const out: DirectionSegment[] = [];
  lines.forEach((l, i) => {
    const age = ageOf(l.text);
    const last = out.at(-1);
    if (age) out.push({ age: ageLabel(l.text, age), lines: [l] });
    else if (groups[i] !== "general" && last?.age) last.lines.push(l);
    else if (last && last.age === null) last.lines.push(l);
    else out.push({ age: null, lines: [l] });
  });
  return out;
}

function max24h(f: Formulation, lines: LabelLine[]): LabelLine | null {
  const text = f.max24hText?.trim();
  if (!text || lines.some((l) => squash(l.text).includes(squash(text)))) return null;
  return { ...line(text, "max_24h_text", 0), marks: markRanges(text) };
}

function directions(f: Formulation): Directions {
  const dosageTableHtml = f.dosageTableHtml;
  const lines = sectionLines(f, "directions").map((l) => ({ ...l, marks: markRanges(l.text) }));
  if (lines.length === 0) {
    // Older rows, and labels whose directions were never split: the text as printed, one line, unmarked.
    const text = f.directionsText?.trim();
    const legacy = text && !dosageTableHtml ? [line(text, "directions_text", 0)] : [];
    return {
      blocks: legacy.length > 0 ? [{ heading: null, segments: [{ age: null, lines: legacy }] }] : [],
      max24h: max24h(f, legacy),
      dosageTableHtml,
    };
  }

  const byForm = lines.filter((l) => isFormHeading(l.text, f.brandName)).length >= 2;
  const chunks: { heading: LabelLine | null; lines: LabelLine[] }[] = [{ heading: null, lines: [] }];
  for (const l of lines) {
    if (byForm && isFormHeading(l.text, f.brandName)) chunks.push({ heading: { text: l.text, ref: l.ref }, lines: [] });
    else chunks.at(-1)!.lines.push(l);
  }
  return {
    blocks: chunks.filter((c) => c.heading || c.lines.length > 0).map((c) => ({ heading: c.heading, segments: segmentsOf(c.lines) })),
    max24h: max24h(f, lines),
    dosageTableHtml,
  };
}

// ---------------------------------------------------------------------------------------------
// Warnings

const OVERDOSE = /\bin case of (?:accidental )?overdose\b|\bpoison control\b|\baccidentally swallowed\b/i;
const OVERDOSE_HEAD = /^overdose warning/i;
/** Drug Facts sections shown as warning cards, in label order. */
const SECTION_CARDS: LabelSectionKey[] = [
  "do_not_use",
  "ask_doctor",
  "ask_doctor_or_pharmacist",
  "when_using",
  "stop_use",
  "pregnancy_or_breast_feeding",
  "keep_out_of_reach",
];

/** Rows imported before `labelSections` existed carry only `directionsText` and `warningsQuotes`. */
function hasSections(f: Formulation): boolean {
  return Object.values(f.labelSections).some((bullets) => bullets?.some(hasText));
}

/** "Liver warning: This product…" → the line after its heading ("This product…"), or null. */
function afterHeading(l: LabelLine, heading: string): LabelLine | null {
  const rest = l.text.slice(heading.length).replace(/^\s*[:.\-–]?\s*/, "");
  return rest ? { text: rest, ref: l.ref } : null;
}

/**
 * The warnings section split at each named warning ("Allergy alert", "Liver warning"), each card
 * holding the lines after it; lines before the first form a "Warnings" card. Then one card per Drug
 * Facts section. Overdose lines (the "Overdose warning" block, "In case of overdose …") go to Took too
 * much? instead, once each. A section line that only repeats its heading isn't listed under it.
 */
function warningCards(f: Formulation): { warnings: WarningCard[]; overdose: LabelLine[] } {
  const overdose: LabelLine[] = [];
  const toOverdose = (l: LabelLine) => {
    if (!overdose.some((o) => squash(o.text) === squash(l.text))) overdose.push(l);
  };
  const cards: WarningCard[] = [];

  if (!hasSections(f)) {
    // Older rows: excerpts, not the label's sequence, so not split by heading.
    const lines = f.warningsQuotes.flatMap((q, i) => (hasText(q) ? [line(q.trim(), "warnings_quotes", i)] : []));
    if (lines.length > 0) cards.push({ kind: "headed", title: "Warnings", section: null, lead: null, lines });
    return { warnings: cards, overdose };
  }

  let current: WarningCard | null = null;
  let inOverdose = false;
  for (const l of sectionLines(f, "warnings")) {
    const head = WARNING_HEAD.exec(l.text);
    if (head) {
      const title = head[0].trim();
      const lead = afterHeading(l, head[0]);
      inOverdose = OVERDOSE_HEAD.test(title);
      if (inOverdose) {
        if (lead) toOverdose(lead);
        current = null;
        continue;
      }
      current = { kind: "headed", title, section: null, lead, lines: [] };
      cards.push(current);
      continue;
    }
    if (inOverdose || OVERDOSE.test(l.text)) {
      toOverdose(l);
      continue;
    }
    if (!current) {
      current = { kind: "headed", title: "Warnings", section: null, lead: null, lines: [] };
      cards.push(current);
    }
    current.lines.push(l);
  }

  for (const key of SECTION_CARDS) {
    const all = sectionLines(f, key);
    if (all.length === 0) continue;
    const title = LABEL_HEADINGS[key] ?? key;
    const lines = all.filter((l) => {
      if (OVERDOSE.test(l.text)) {
        toOverdose(l);
        return false;
      }
      return squash(l.text).replace(/[.:]+$/, "") !== squash(title);
    });
    if (lines.length > 0 || key === "keep_out_of_reach") cards.push({ kind: "section", title, section: key, lead: null, lines });
  }
  for (const l of sectionLines(f, "other_information")) if (OVERDOSE.test(l.text)) toOverdose(l);

  return { warnings: cards, overdose };
}

// ---------------------------------------------------------------------------------------------
// Good to know: the quick answers' keyword rules, unchanged.

const GOOD_TO_KNOW: [GoodToKnowKey, string][] = [
  ["alcohol", "Alcohol"],
  ["food", "With food?"],
  ["drowsiness", "Drowsiness and driving"],
  ["allergies", "Allergies"],
];

function goodToKnow(f: Formulation): GoodToKnowTile[] {
  const answers = new Map(quickAnswers(f).map((a) => [a.key, a]));
  return GOOD_TO_KNOW.map(([key, title]) => {
    const a = answers.get(key);
    // The inactive ingredients are long and per form; the Allergies tile links to them on the Original tab.
    const bullets =
      key === "allergies"
        ? (a?.groups ?? []).filter((g) => g.heading !== LABEL_HEADINGS.inactive_ingredients).flatMap((g) => g.bullets)
        : (a?.bullets ?? []);
    return { key, title, bullets, notOnLabel: a?.notOnLabel ?? null };
  });
}

export function medicationFacts(f: Formulation): MedicationFacts {
  const { warnings, overdose } = warningCards(f);
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
    uses: usesGroups(f),
    directions: directions(f),
    warnings,
    overdose,
    goodToKnow: goodToKnow(f),
    source: { kind: f.source, setId: f.openfdaSetId, ndcs: f.ndcPackages, links: f.sourceLinks },
  };
}
