// Drug Facts sections → short bullets for the medicine card. Pure.
//
// Never reworded: a section's label text is tidied once (whitespace collapsed, repeated headings
// dropped — the existing `tidy()` — and bullet glyphs removed), and every bullet is a contiguous span of
// it. Bullets are cut, in order of trust, at:
//   1. the label's own blocks from DailyMed's SPL XML (titles, paragraphs, list items), when available;
//   2. bullet glyphs (■ • ▪ …), which openFDA keeps on about a quarter of labels;
//   3. product sub-headings on labels covering several products ("Advil Tablets", "Advil Caplets");
//   4. sentence ends and Drug Facts subheadings ("Liver warning", "Ask a doctor");
//   5. only where neither 1 nor 2 applies: known OTC monograph list items ("right before or after heart
//      surgery", "headache", "heart disease") and item patterns (an age group or "do not …" in directions,
//      "you have" in ask-a-doctor lists). Pattern cuts never fall inside parentheses.
// A lead-in ("you have", "Symptoms may include:", "if your child takes", a subheading) never stands alone:
// it is joined with the item that follows it, which is still one contiguous span of the label text.
import type { LabelSectionKey, LabelSections } from "@/lib/domain/schema";
import { LABEL_SECTION_KEYS } from "@/lib/domain/schema";
import { tidy } from "@/lib/openfda";
import { findPrinted, parenDepths } from "./label-strength";
import type { SplBlock, SplSections } from "./spl";
import type { FdaLabel } from "./types";

const OTHER_INFORMATION_FIELDS = ["storage_and_handling", "other_safety_information"];

/** openFDA label fields (verified on real records) that hold each card section. */
export const LABEL_SECTION_FIELDS: Record<LabelSectionKey, string[]> = {
  uses: ["indications_and_usage"],
  purpose: ["purpose"],
  directions: ["dosage_and_administration"],
  do_not_use: ["do_not_use"],
  ask_doctor: ["ask_doctor"],
  ask_doctor_or_pharmacist: ["ask_doctor_or_pharmacist"],
  when_using: ["when_using"],
  stop_use: ["stop_use"],
  pregnancy_or_breast_feeding: ["pregnancy_or_breast_feeding"],
  warnings: ["warnings"],
  keep_out_of_reach: ["keep_out_of_reach_of_children"],
  inactive_ingredients: ["inactive_ingredient"],
  // Both come from the label's "Other information": storage lines go to `storage`, the rest stays here.
  storage: OTHER_INFORMATION_FIELDS,
  other_information: OTHER_INFORMATION_FIELDS,
  questions: ["questions"],
};

const GLYPH_CHARS = "■●•▪◼◆♦►▶✓✔□○‣⁃·∙￭";
const GLYPH = new RegExp(`[${GLYPH_CHARS}]`, "u");
const GLYPHS_G = new RegExp(`[${GLYPH_CHARS}]`, "gu");
const GLYPH_RUN = new RegExp(`\\s*[${GLYPH_CHARS}]+\\s*`, "gu");
const TRIM_START = new RegExp(`^[\\s${GLYPH_CHARS},;:.*†)\\-–—]+`, "u");
const TRIM_END = new RegExp(`[\\s${GLYPH_CHARS},;*†\\-–—]+$`, "u");

const stripGlyphs = (text: string) => text.replace(GLYPH_RUN, " ").replace(/\s+/g, " ").trim();

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const OTHER_INFO_HEADING = /^(?:other (?:safety )?[il]nformation|storage(?: and handling)?)(?![\p{L}'])/iu;

/** The heading each section's text starts with on the label (repeated in openFDA: "Uses Uses"). */
const HEADINGS: Partial<Record<LabelSectionKey, RegExp>> = {
  uses: /^(?:uses?(?:\s*\(s\))?|indications?(?: (?:and|&) usage)?)(?![\p{L}'])/iu,
  purpose: /^(?:active ingredients?(?:\s*\([^)]*\))?\s*)?purposes?(?![\p{L}'])/iu,
  directions: /^(?:directions?(?: for use)?|dosage (?:and|&) administration|suggested use)(?![\p{L}'])(?:\s*\([^)]*\bonly\))?/iu,
  do_not_use: /^do not use(?![\p{L}'])/iu,
  ask_doctor: /^ask (?:a )?doctor(?: before us ?e)?(?: if)?(?![\p{L}'])/iu,
  ask_doctor_or_pharmacist: /^ask (?:a )?doctor or pharmacist(?: before use)?(?: if)?(?![\p{L}'])/iu,
  when_using: /^when using this product(?![\p{L}'])/iu,
  stop_use: /^stop use and ask a doctor ?(?:if)?(?![\p{L}'])/iu,
  pregnancy_or_breast_feeding: /^(?:pregnancy(?:\s*(?:\/|or)\s*breast-?feeding)?|breast-?feeding)(?![\p{L}'])/iu,
  warnings: /^warnings?(?![\p{L}'])/iu,
  inactive_ingredients: /^inactive(?: ingredients?)?(?![\p{L}'])(?:\s*\([^)]*\bonly\))?/iu,
  storage: OTHER_INFO_HEADING,
  other_information: OTHER_INFO_HEADING,
  questions: /^questions(?: or comments)?\s*\??/iu,
};
const DRUG_FACTS = /^drug facts(?:\s*\(continued\))?(?![\p{L}'])/iu;

/** A bullet that is nothing but a heading (or a scrap of one) is dropped. */
const HEADING_ONLY =
  /^(?:drug facts(?:\s*\(continued\))?|drug|facts|\(s\)|uses?(?:\s*\(s\))?|indications?(?: (?:and|&) usage)?|purposes?|directions?|warnings?|other (?:safety )?[il]nformation|storage(?: and handling)?|inactive(?: ingredients?)?|active ingredients?(?:\s*\([^)]*\))?(?:\s*purposes?)?|ask (?:a )?doctor(?: or pharmacist)?(?: before use)?(?: if)?|do not use|stop use(?: and ask a doctor)?(?: if)?|when using this product|pregnancy(?:\s*(?:\/|or)\s*breast-?feeding)?|breast-?feeding|questions(?: or comments)?\??|\([^)]*\bonly\)|(?:directions?|inactive ingredients?)\s*\([^)]*\bonly\)|(?:ask (?:a )?doctor(?: or pharmacist)? )?before us ?e(?: if)?(?: you (?:have|are)| your child (?:has|is))?|stop use and ask a doctor ?if)[\s:.)\-–*]*$/iu;

/** Drug Facts subheadings as printed (capitalized). Where they appear inside a section, a new bullet starts. */
const SUBHEADINGS: [string, LabelSectionKey | null][] = [
  ["Liver warning", null],
  ["Allergy alert", null],
  ["Stomach bleeding warning", null],
  ["Heart attack and stroke warning", null],
  ["Sore throat warning", null],
  ["Overdose warning", null],
  ["Reye's syndrome", null],
  ["Alcohol warning", null],
  ["Choking", null],
  ["Do not use", "do_not_use"],
  ["Ask a doctor or pharmacist", "ask_doctor_or_pharmacist"],
  ["Ask a doctor", "ask_doctor"],
  ["When using this product", "when_using"],
  ["Stop use", "stop_use"],
  ["If pregnant or breast-feeding", "pregnancy_or_breast_feeding"],
  ["If pregnant or breastfeeding", "pregnancy_or_breast_feeding"],
  ["Keep out of reach of children", "keep_out_of_reach"],
  ["Other information", "other_information"],
  ["Inactive ingredients", "inactive_ingredients"],
  ["Directions", "directions"],
  ["Questions or comments?", "questions"],
  ["Questions?", "questions"],
];
const SUBHEADING_RE = new RegExp(
  `(?<![\\p{L}])(?:${SUBHEADINGS.map(([h]) => escapeRegExp(h).replace(/'/g, "['’]")).join("|")})(?![\\p{L}])`,
  "gu",
);
const subheadingKey = (phrase: string) => SUBHEADINGS.find(([h]) => h.replace(/'/g, "’") === phrase.replace(/'/g, "’"))?.[1] ?? null;

/** Capitalized words that start a new sentence on Drug Facts labels even without a period before them. */
const STARTERS = /(?<=[\p{Ll}\d)%] )(?:If|These|This|Ask|Stop|Keep|When|In case|Symptoms|Taking|Consult|Seek|Avoid|Talk|Discontinue|Read|Store|Protect|Contains)(?![\p{L}])/gu;

const ABBREVIATIONS = new Set(
  "e.g i.e u.s inc co no dr st vs approx pat oz fl ltd jr mt tsp tbsp hr hrs yr yrs min max mg mcg ml lb lbs wt etc".split(" "),
);

/** Words after which a cut would split a phrase ("give to | children under 6"). */
const NO_CUT_AFTER = new Set(
  "if when that unless because and or while as since until whether after before to for in of by not give where than with the a an are is may can will which who".split(" "),
);

/** Patterns that start a new item in flattened (glyph-less, XML-less) sections. */
const ITEM_STARTS: Partial<Record<LabelSectionKey, RegExp[]>> = {
  directions: [
    /\bdo not (?:take|give|use|exceed|administer)\b/gi,
    /\b(?:shake well|take only|use only)\b/gi,
  ],
  uses: [/\b(?:temporarily|helps)\b/gi],
  do_not_use: [/\b(?:you (?:have|are)|your child (?:has|is))\b/gi],
  ask_doctor: [/\b(?:you (?:have|are|experience|get|develop|notice|feel|take)|your child (?:has|is|takes))\b/gi],
  ask_doctor_or_pharmacist: [/\b(?:you (?:are|take)|your child (?:is|takes))\b/gi],
  stop_use: [/\b(?:you (?:have|are|experience|get|develop|notice|feel)|your child (?:has|is|gets|develops))\b/gi],
  other_information: [
    /\b(?:store|protect from|keep (?:in|at|tightly|away)|do not use if|each [\p{L} .]{1,25}? contains|retain|read all|see (?:end|side|top|bottom|back) panel|avoid excessive)\b/giu,
  ],
};

const AGE_LINE = /^(?:adults|children|infants|teens|teenagers|consumers|persons|people)\b/i;
const INSTRUCTION = /\b(?:take|give|use|ask|chew|dissolve|swallow|drink|mix|place|consult|apply|do not|repeat|shake|see)\b/i;

/** An age group starts a directions line ("adults and children 12-64 years", "children under 6 years"). */
const AGE_GROUP = /\b(?:(?:adults(?: and children)?|children|infants|teens|teenagers)\s+(?:\d|under\b|over\b|ages?\b|from\b|\()|(?:consumers|persons|people) with\b)/gi;

/** OTC monograph list items: in flattened text a new item starts at each (never mid-parenthesis). */
const MONOGRAPH_ITEMS: Partial<Record<LabelSectionKey, string[]>> = {
  uses: [
    "the common cold", "headache", "toothache", "backache", "menstrual cramps", "premenstrual and menstrual cramps",
    "muscular aches", "minor pain of arthritis", "sore throat", "nasal congestion", "sinus congestion", "runny nose",
    "sneezing", "itchy, watery eyes", "itching of the nose or throat",
  ],
  do_not_use: [
    "right before or after heart surgery", "if you have ever had an allergic reaction", "if you are allergic to",
    "with any other drug containing", "with any other product containing", "to make a child sleepy",
    "if you are now taking a prescription monoamine oxidase inhibitor",
  ],
  ask_doctor: [
    "liver disease", "heart disease", "high blood pressure", "thyroid disease", "diabetes", "glaucoma",
    "trouble urinating", "a breathing problem", "cough that occurs with too much phlegm", "persistent or chronic cough",
    "kidney disease", "stomach bleeding warning applies to you", "a sodium-restricted diet",
  ],
  ask_doctor_or_pharmacist: [
    "taking aspirin for heart attack or stroke", "taking any other drug", "taking sedatives or tranquilizers",
    "taking the blood thinning drug warfarin", "taking a prescription drug", "taking any other pain reliever",
    "taking a diuretic",
  ],
  stop_use: [
    "pain gets worse", "fever gets worse", "new symptoms occur", "redness or swelling is present", "symptoms do not get better",
    "nervousness, dizziness, or sleeplessness occur", "you get nervous, dizzy or sleepless", "cough lasts more than",
    "pain or nasal congestion gets worse", "an allergic reaction occurs", "any new symptoms appear", "feel faint", "vomit blood",
    "have bloody or black stools", "have stomach pain that does not get better", "chest pain", "trouble breathing",
    "weakness in one part or side of body", "slurred speech", "leg swelling", "ringing in the ears or a loss of hearing occurs",
  ],
};
const monographRe = (key: LabelSectionKey) => {
  const items = MONOGRAPH_ITEMS[key];
  if (!items) return null;
  return {
    re: new RegExp(`(?<![\\p{L}])(?:${[...items].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|")})(?![\\p{L}])`, "giu"),
    endsWithItem: new RegExp(`(?:${items.map(escapeRegExp).join("|")})$`, "iu"),
  };
};

const STORAGE_LINE = /^(?:store|keep (?:in|at|tightly|away from (?:heat|light|moisture))|protect from|avoid (?:excessive )?(?:heat|freezing|humidity|high temperatures?|direct sunlight)|do not (?:freeze|refrigerate|store)|storage)\b/i;
const NOT_STORAGE = /do not use if|tamper|seal|contains|sodium|calcium|phenylketonurics|\blot\b|\bexp\b|\bsee\b|retain|read all|carton|packet|blister/i;

/** A piece that needs what follows it: "you have", "Symptoms may include:", "if your child takes", a subheading. */
const LEAD_IN_END = /(?:^|\s)(?:if|takes?|includes?|of|with|the|a|an|and|or|than|for|such as|due to|following|your child)$/i;
/** Short fragments that only open a sentence: "you have", "you are", "if you", "your child is". */
const SHORT_LEAD_IN = /^(?:if )?(?:you|your child)(?: (?:have|are|has|is|take|get|are taking|have ever had))?$|^if$/i;

// ---------------------------------------------------------------------------
// Label text
// ---------------------------------------------------------------------------

/** A field's entries, each once: multi-product labels repeat whole blocks in separate entries. */
export function fieldTexts(label: FdaLabel, fields: string | string[]): string[] {
  const kept: { raw: string; norm: string }[] = [];
  for (const field of Array.isArray(fields) ? fields : [fields]) {
    const value = label[field];
    if (!Array.isArray(value)) continue;
    for (const raw of value) {
      if (typeof raw !== "string") continue;
      const norm = stripGlyphs(tidy(raw)).toLowerCase();
      if (!norm || kept.some((k) => k.norm.includes(norm))) continue;
      for (let i = kept.length - 1; i >= 0; i--) if (norm.includes(kept[i].norm)) kept.splice(i, 1);
      kept.push({ raw, norm });
    }
  }
  return kept.map((k) => k.raw);
}

/** The section's text with bullet glyphs still in it — where cuts are found. */
function rawSectionText(label: FdaLabel, key: LabelSectionKey): string | null {
  return tidy(fieldTexts(label, LABEL_SECTION_FIELDS[key]).join(" ")) || null;
}

/** A section's label text, joined and tidied — the text every bullet is cut from. Null if the label lacks it. */
export function sectionText(label: FdaLabel, key: LabelSectionKey): string | null {
  const raw = rawSectionText(label, key);
  return raw ? stripGlyphs(raw) || null : null;
}

/** Every section's tidied text; each card bullet is a substring of one of them. */
export function labelSourceTexts(label: FdaLabel): string[] {
  return [...new Set(LABEL_SECTION_KEYS.map((k) => sectionText(label, k)).filter((t): t is string => t !== null))];
}

/** The Active ingredient(s) text, each repeated block once. */
export function activeIngredientText(label: FdaLabel): string {
  return tidy(fieldTexts(label, "active_ingredient").join(" "));
}

/** A label whose sections hold only heading words ("dosage and admin", "ask a doc") and no amounts. */
export function isPlaceholder(label: FdaLabel): boolean {
  const texts = LABEL_SECTION_KEYS.map((k) => sectionText(label, k)).filter((t): t is string => t !== null);
  if (texts.length < 2) return false;
  const active = activeIngredientText(label);
  return !/\d/.test(active) && [...texts, active].every((t) => t.split(/\s+/).filter(Boolean).length <= 4);
}

/** "Advil Tablets (in each tablet) … Advil Caplets (in each caplet)" → the product sub-headings. */
export function productNames(activeText: string): string[] {
  const names = new Set<string>();
  for (const m of activeText.matchAll(/((?:[A-Z][\p{L}\d'’®&.-]*\s+){0,4}[A-Z][\p{L}\d'’®&.-]*)\s*\(\s*[Ii]n [Ee]ach/gu)) {
    const name = m[1].replace(/^(?:active\s+)?ingredients?\b\s*/i, "").replace(/^active\b\s*/i, "").trim();
    if (name.split(/\s+/).length >= 2 && name !== name.toUpperCase()) names.add(name);
  }
  return names.size >= 2 ? [...names] : [];
}

// ---------------------------------------------------------------------------
// Splitting
// ---------------------------------------------------------------------------

type Span = [number, number];

export type SplitOptions = {
  exclude?: Span[];
  /** The label's own SPL blocks for this section, in document order. */
  blocks?: SplBlock[];
  productNames?: string[];
  /** Active ingredient names, so a purpose sharing a table with them keeps only the purposes. */
  ingredientNames?: string[];
};

function previousWord(text: string, index: number): string {
  const before = text.slice(0, index).trimEnd();
  const m = before.match(/([\p{L}'’.]+)[^\p{L}]*$/u);
  return m ? m[1].toLowerCase().replace(/[.’']+$/, "") : "";
}

function previousChar(text: string, index: number): string {
  return text.slice(0, index).trimEnd().slice(-1);
}

/** Where the heading (possibly repeated, possibly after "Drug Facts") ends at the start of the text. */
function headingEnd(text: string, key: LabelSectionKey): number {
  const heading = HEADINGS[key];
  let start = 0;
  for (let i = 0; i < 5; i++) {
    const lead = text.slice(start).match(TRIM_START)?.[0].length ?? 0;
    const rest = text.slice(start + lead);
    const m = rest.match(DRUG_FACTS) ?? (heading ? rest.match(heading) : null);
    if (!m) break;
    start += lead + m[0].length;
  }
  return start;
}

/** Find the SPL blocks in the text, in order. Returns their spans and which are titles. */
function locateBlocks(text: string, start: number, blocks: SplBlock[]): { spans: Span[]; titles: Set<number>; covered: number } {
  const spans: Span[] = [];
  const titles = new Set<number>();
  let cursor = start;
  let covered = 0;
  for (const block of blocks) {
    const needle = stripGlyphs(tidy(block.text));
    if (needle.length < 2) continue;
    const at = text.indexOf(needle, cursor);
    if (at < 0 || (needle.length < 15 && at - cursor > 200)) continue;
    spans.push([at, at + needle.length]);
    if (block.title) titles.add(at);
    covered += needle.length;
    cursor = at + needle.length;
  }
  return { spans, titles, covered };
}

/** Split one section's tidied text into bullets. `exclude` spans are left out entirely. */
export function splitSection(key: LabelSectionKey, text: string, options: SplitOptions = {}): string[] {
  const exclude = [...(options.exclude ?? [])];
  const start = headingEnd(text, key);
  const depth = parenDepths(text);
  const cuts = new Set<number>([start, text.length]);
  const hard = (i: number) => {
    if (i > start && i < text.length) cuts.add(i);
  };
  const soft = (i: number) => {
    if (depth[i] === 0) hard(i);
  };

  const located = locateBlocks(text, start, options.blocks ?? []);
  const xml = located.covered >= 0.5 * Math.max(1, text.length - start);
  for (const [s, e] of located.spans) {
    hard(s);
    hard(e);
  }
  const glyphs = GLYPH.test(text.slice(start));
  for (const m of text.matchAll(GLYPHS_G)) hard(m.index!);

  const products = new Set<number>();
  for (const name of options.productNames ?? []) {
    for (const m of text.matchAll(new RegExp(`(?<![\\p{L}])${escapeRegExp(name)}(?![\\p{L}])`, "gu"))) {
      hard(m.index!);
      hard(m.index! + m[0].length);
      products.add(m.index!);
    }
  }

  for (const m of text.matchAll(/[.!?](?=\s+["“(]?\p{Lu})/gu)) {
    if (ABBREVIATIONS.has(previousWord(text, m.index! + 1))) continue;
    soft(m.index! + 1 + (text.slice(m.index! + 1).match(/^\s+/)?.[0].length ?? 0));
  }
  const headingSpans = new Map<number, number>(); // start → end of a subheading or SPL title
  for (const [s, e] of located.spans) if (located.titles.has(s)) headingSpans.set(s, e);
  const subheadingEnds = new Set<number>();
  for (const m of text.matchAll(SUBHEADING_RE)) {
    soft(m.index!);
    if (!headingSpans.has(m.index!)) headingSpans.set(m.index!, m.index! + m[0].length);
    subheadingEnds.add(m.index! + m[0].length + 1); // "Liver warning This product…": keep together
  }

  if (key === "purpose") {
    const names = options.ingredientNames ?? [];
    for (const name of names) {
      const p = findPrinted(text, name, names.filter((n) => n !== name));
      if (!p || p.start < start) continue;
      const tail = text.slice(p.end).match(/^\s*(?:\([^)]*\)\s*)*\**/)?.[0].length ?? 0;
      exclude.push([p.start, p.end + tail]);
    }
    const words = text.slice(start).match(/\p{L}+/gu) ?? [];
    const titleCased = words.filter((w) => /^\p{Lu}/u.test(w)).length > 0.6 * words.length;
    if (exclude.length === (options.exclude ?? []).length && !titleCased) {
      for (const m of text.matchAll(/(?<=\p{Ll} )\p{Lu}/gu)) soft(m.index!);
    }
  }

  if (!xml) {
    for (const m of text.matchAll(STARTERS)) if (!subheadingEnds.has(m.index!)) soft(m.index!);
    for (const m of text.matchAll(/(?<=\s)[-–](?=\p{L})/gu)) soft(m.index!); // "-the common cold" dash bullets
  }
  if (!xml && key === "directions") {
    for (const m of text.matchAll(AGE_GROUP)) {
      if (NO_CUT_AFTER.has(previousWord(text, m.index!)) || previousChar(text, m.index!) === ":") continue;
      soft(m.index!);
    }
  }
  if (!xml && !glyphs) {
    // Flattened lists: "…ask a doctor or pharmacist. if you are allergic…" — a new lowercase item.
    for (const m of text.matchAll(/[.!?](?=\s+\p{Ll})/gu)) {
      if (ABBREVIATIONS.has(previousWord(text, m.index! + 1))) continue;
      soft(m.index! + 1 + (text.slice(m.index! + 1).match(/^\s+/)?.[0].length ?? 0));
    }
    const patternKey = key === "storage" ? "other_information" : key;
    for (const re of ITEM_STARTS[patternKey] ?? []) {
      for (const m of text.matchAll(re)) {
        if (NO_CUT_AFTER.has(previousWord(text, m.index!)) || previousChar(text, m.index!) === ":") continue;
        soft(m.index!);
      }
    }
    const monograph = monographRe(key);
    if (monograph) {
      for (const m of text.matchAll(monograph.re)) {
        const i = m.index!;
        if (!/[\p{L}\d)]/u.test(previousChar(text, i)) || NO_CUT_AFTER.has(previousWord(text, i))) continue;
        if (!m[0].includes(" ") && !monograph.endsWithItem.test(text.slice(0, i).trimEnd())) continue; // "sinus | headache"
        soft(i);
      }
    }
  }
  for (const [s, e] of exclude) {
    hard(s);
    hard(e);
  }

  // Pieces → trimmed spans.
  const sorted = [...cuts].sort((a, b) => a - b);
  type Piece = { a: number; b: number; raw: number; product: boolean };
  const pieces: Piece[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const [a, b] = [sorted[i], sorted[i + 1]];
    if (exclude.some(([s, e]) => a >= s && b <= e)) continue;
    if (key === "purpose" && /^\s*\*/.test(text.slice(a, b))) continue; // "*nonsteroidal anti-inflammatory drug" footnote
    const piece = text.slice(a, b);
    const lead = piece.match(TRIM_START)?.[0].length ?? 0;
    const trail = piece.slice(lead).match(TRIM_END)?.[0].length ?? 0;
    const s = a + lead;
    const e = b - trail;
    if (e - s < 2) continue;
    pieces.push({ a: s, b: e, raw: b, product: products.has(s) });
  }

  // Lead-ins join the piece that follows them (contiguous text only); otherwise they're dropped.
  const isLeadIn = (p: Piece) => {
    if (p.product) return false;
    const t = stripGlyphs(text.slice(p.a, p.b));
    if (/:$/.test(t) || LEAD_IN_END.test(t) || SHORT_LEAD_IN.test(t)) return true;
    // "adults 65 years of age and older" ■ "ask a doctor": an age line joins its instruction.
    if (key === "directions" && AGE_LINE.test(t) && !INSTRUCTION.test(t) && t.split(/\s+/).length <= 12) return true;
    const end = headingSpans.get(p.a);
    if (end === undefined || /[.!?]$/.test(t)) return false;
    // "Ask a doctor before use if you have" ■ … : a subheading with a short opening joins its first item.
    const tail = text.slice(end, p.b).trim();
    return p.b <= end + 1 || (tail.split(/\s+/).length <= 5 && /(?:^|\s)(?:if|you|have|are|has|is|taking|you have|you are)$/i.test(tail));
  };
  const joined: Span[] = [];
  for (let i = 0; i < pieces.length; i++) {
    let span: Span = [pieces[i].a, pieces[i].b];
    let current = pieces[i];
    while (isLeadIn(current)) {
      const next = pieces[i + 1];
      const gap = next ? text.slice(current.raw, next.a) : "x";
      if (!next || next.product || (next.a !== current.raw && !/^[\s,;:.*†)\-–—]*$/u.test(stripGlyphs(gap)))) {
        span = [-1, -1];
        break;
      }
      span = [span[0], next.b];
      current = next;
      i++;
    }
    if (span[0] >= 0) joined.push(span);
  }

  const bullets: string[] = [];
  for (const [a, b] of joined) {
    const bullet = stripGlyphs(text.slice(a, b)).replace(TRIM_START, "").replace(TRIM_END, "");
    // Headings are capitalized: a lowercase "ask a doctor" / "do not use" is an instruction and stays.
    if (bullet.length < 2 || !/\p{L}/u.test(bullet) || (/^[\p{Lu}(]/u.test(bullet) && HEADING_ONLY.test(bullet))) continue;
    if (bullets[bullets.length - 1] === bullet) continue; // the same line twice in a row
    bullets.push(bullet);
  }
  return dropRepeatedBlocks(bullets);
}

/** Remove a run of 2+ bullets that exactly repeats an earlier run; a lone repeated bullet stays ("sneezing"). */
export function dropRepeatedBlocks(bullets: string[]): string[] {
  const out: string[] = [];
  const key = (list: string[]) => list.join("\u0000");
  for (let i = 0; i < bullets.length; ) {
    let skip = 0;
    for (let k = Math.min(bullets.length - i, out.length); k >= 2 && !skip; k--) {
      const block = key(bullets.slice(i, i + k));
      for (let j = 0; j + k <= out.length; j++) {
        if (key(out.slice(j, j + k)) === block) {
          skip = k;
          break;
        }
      }
    }
    if (skip) i += skip;
    else out.push(bullets[i++]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

/** Plain text of a dosing-table HTML fragment, spaced the way openFDA flattens it into the directions. */
function tableText(html: string): string {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
  return tidy(text);
}

const comparable = (t: string) => stripGlyphs(t).toLowerCase().replace(/[^\p{L}\d]+/gu, " ").trim();

/**
 * Regions (subheading → next subheading) whose subheading belongs to one of `keys` and whose text really
 * is that section's (`sections` given): "When using this product, if changes in behavior…" inside the
 * Reye's syndrome warning is not the label's When-using section and stays.
 */
function regions(text: string, keys: Set<LabelSectionKey>, sections?: Map<LabelSectionKey, string>): Span[] {
  const depth = parenDepths(text);
  const hits = [...text.matchAll(SUBHEADING_RE)]
    .filter((m) => depth[m.index!] === 0) // "(see Directions)" is a reference, not a heading
    .map((m) => ({ index: m.index!, phrase: m[0], key: subheadingKey(m[0]) }));
  const out: Span[] = [];
  hits.forEach((hit, i) => {
    if (!hit.key || !keys.has(hit.key)) return;
    const span: Span = [hit.index, hits[i + 1]?.index ?? text.length];
    const target = sections?.get(hit.key);
    if (sections && target !== undefined) {
      const body = comparable(text.slice(span[0] + hit.phrase.length, span[1]));
      if (body && !comparable(target).includes(body)) return;
    }
    out.push(span);
  });
  return out;
}

const keyFamily = (k: LabelSectionKey): LabelSectionKey[] => (k === "storage" || k === "other_information" ? ["storage", "other_information"] : [k]);

export type SectionOptions = { spl?: SplSections | null; ingredientNames?: string[] };

/** Every card section the label has, as bullets. */
export function labelSections(label: FdaLabel, options: SectionOptions = {}): LabelSections {
  const texts = new Map<LabelSectionKey, string>();
  for (const key of LABEL_SECTION_KEYS) {
    if (key === "storage") continue; // split together with other_information below
    const text = rawSectionText(label, key);
    if (text) texts.set(key, text);
  }
  if (texts.has("other_information")) texts.set("storage", texts.get("other_information")!);
  const present = new Set(texts.keys());
  const products = productNames(activeIngredientText(label));
  const blocksFor = (key: LabelSectionKey) => {
    const family = keyFamily(key);
    return (options.spl?.blocks ?? []).filter((b) => b.keys.some((k) => family.includes(k)));
  };

  const sections: LabelSections = {};
  let questionsRegion: string | null = null;
  for (const [key, text] of texts) {
    if (key === "storage") continue;
    const exclude: Span[] = [];
    if (key === "directions") {
      for (const html of fieldTexts(label, "dosage_and_administration_table")) {
        const table = tableText(html);
        const at = table.length > 20 ? text.indexOf(table) : -1;
        if (at >= 0) exclude.push([at, at + table.length]);
      }
    }
    if (key === "warnings") {
      exclude.push(...regions(text, new Set([...present].filter((k) => k !== "warnings")), texts));
    }
    if (key !== "questions") {
      const q = regions(text, new Set<LabelSectionKey>(["questions"]));
      if (q.length > 0 && !questionsRegion) questionsRegion = text.slice(q[0][0], q[0][1]);
      exclude.push(...q);
    }
    if (key === "inactive_ingredients" || key === "directions") {
      exclude.push(...regions(text, new Set([...present].filter((k) => k === "other_information")), texts));
    }

    const bullets = splitSection(key, text, {
      exclude,
      blocks: blocksFor(key),
      productNames: products,
      ingredientNames: key === "purpose" ? options.ingredientNames : undefined,
    });
    if (key === "other_information") {
      const storage = bullets.filter((b) => STORAGE_LINE.test(b) && !NOT_STORAGE.test(b));
      const other = bullets.filter((b) => !storage.includes(b));
      if (storage.length > 0) sections.storage = storage;
      if (other.length > 0) sections.other_information = other;
    } else if (bullets.length > 0) {
      sections[key] = bullets;
    }
  }
  if (!sections.questions && questionsRegion) {
    const bullets = splitSection("questions", questionsRegion, { blocks: blocksFor("questions") });
    if (bullets.length > 0) sections.questions = bullets;
  }
  return sections;
}
