// Drug Facts sections → short bullets for the medicine card. Pure.
//
// Never reworded: a section's text is tidied once (`sectionText`: whitespace collapsed, repeated headings
// dropped — the existing `tidy()`), then bullets are cut out of it as index spans and trimmed of bullet
// glyphs and stray punctuation. Every bullet is therefore a substring of the tidied text (tested).
//
// openFDA keeps the label's bullet glyphs (■ • ▪ …) on about a quarter of labels and flattens the rest
// into plain spaces, so cuts come from, in order of trust: the glyphs; sentence ends; the label's own
// subheadings ("Liver warning", "Ask a doctor"…); and, only where a section has no glyphs, a few
// Drug Facts patterns that start a new item (an age group or "do not …" in directions, "temporarily" in
// uses, "you have / you are" in ask-a-doctor and stop-use lists). Flattened lists without such
// patterns ("headache backache toothache") stay together in one bullet rather than being guessed apart.
import type { LabelSectionKey, LabelSections } from "@/lib/domain/schema";
import { LABEL_SECTION_KEYS } from "@/lib/domain/schema";
import { tidy } from "@/lib/openfda";
import type { FdaLabel } from "./types";

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
  storage: ["storage_and_handling", "other_safety_information"],
};

const GLYPH_CHARS = "■●•▪◼◆♦►▶✓✔□○‣⁃·∙￭";
const GLYPH = new RegExp(`[${GLYPH_CHARS}]`, "u");
const GLYPHS_G = new RegExp(`[${GLYPH_CHARS}]`, "gu");
const TRIM_START = new RegExp(`^[\\s${GLYPH_CHARS},;:.*†\\-–—]+`, "u");
const TRIM_END = new RegExp(`[\\s${GLYPH_CHARS},;*†\\-–—]+$`, "u");

/** The heading each section's text starts with on the label (repeated in openFDA: "Uses Uses"). */
const HEADINGS: Partial<Record<LabelSectionKey, RegExp>> = {
  uses: /^(?:uses?|indications?(?: (?:and|&) usage)?)(?![\p{L}'])/iu,
  purpose: /^purposes?(?![\p{L}'])/iu,
  directions: /^(?:directions?(?: for use)?|dosage (?:and|&) administration|suggested use)(?![\p{L}'])/iu,
  do_not_use: /^do not use(?![\p{L}'])/iu,
  ask_doctor: /^ask a doctor before use(?: if)?(?![\p{L}'])/iu,
  ask_doctor_or_pharmacist: /^ask a doctor or pharmacist before use(?: if)?(?![\p{L}'])/iu,
  when_using: /^when using this product(?![\p{L}'])/iu,
  stop_use: /^stop use and ask a doctor(?: if)?(?![\p{L}'])/iu,
  warnings: /^warnings?(?![\p{L}'])/iu,
  inactive_ingredients: /^inactive(?: ingredients?)?(?![\p{L}'])/iu,
  storage: /^(?:other (?:safety )?information|storage(?: and handling)?)(?![\p{L}'])/iu,
};

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
  ["Other information", "storage"],
  ["Inactive ingredients", "inactive_ingredients"],
  ["Directions", "directions"],
];
const SUBHEADING_RE = new RegExp(`(?<![\\p{L}])(?:${SUBHEADINGS.map(([h]) => h.replace(/'/g, "['’]")).join("|")})(?![\\p{L}])`, "gu");

/** Capitalized words that start a new sentence on Drug Facts labels even without a period before them. */
const STARTERS = /(?<=[\p{Ll}\d)%] )(?:If|These|This|Ask|Stop|Keep|When|In case|Symptoms|Taking|Consult|Seek|Avoid|Talk|Discontinue|Read|Store|Protect|Contains)(?![\p{L}])/gu;

const ABBREVIATIONS = new Set(
  "e.g i.e u.s inc co no dr st vs approx pat oz fl ltd jr mt tsp tbsp hr hrs yr yrs min max mg mcg ml lb lbs wt approx etc".split(" "),
);

/** Words after which a cut would split a phrase ("give to | children under 6"). */
const NO_CUT_AFTER = new Set(
  "if when that unless because and or while as since until whether after before to for in of by not give where than with the a an are is may can will which who".split(" "),
);

/** Patterns that start a new item in flattened (glyph-less) sections. */
const ITEM_STARTS: Partial<Record<LabelSectionKey, RegExp[]>> = {
  directions: [
    /\b(?:adults(?: and children)?|children|infants|teens|teenagers)\s+(?:\d|under\b|over\b|ages?\b|from\b|\()/gi,
    /\bdo not (?:take|give|use|exceed|administer)\b/gi,
    /\b(?:shake well|take only|use only)\b/gi,
  ],
  uses: [/\b(?:temporarily|helps)\b/gi],
  do_not_use: [/\b(?:you (?:have|are)|your child (?:has|is))\b/gi],
  ask_doctor: [/\b(?:you (?:have|are|experience|get|develop|notice|feel|take)|your child (?:has|is|takes))\b/gi],
  ask_doctor_or_pharmacist: [/\b(?:you (?:are|take)|your child (?:is|takes))\b/gi],
  stop_use: [/\b(?:you (?:have|are|experience|get|develop|notice|feel)|your child (?:has|is|gets|develops))\b/gi],
};

/** A section's label text, joined and tidied — the text every bullet is cut from. Null if the label lacks it. */
export function sectionText(label: FdaLabel, key: LabelSectionKey): string | null {
  const parts = LABEL_SECTION_FIELDS[key].flatMap((field) => {
    const value = label[field];
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  });
  const text = tidy(parts.join(" "));
  return text || null;
}

type Span = [number, number];

function previousWord(text: string, index: number): string {
  const before = text.slice(0, index).trimEnd();
  const m = before.match(/([\p{L}'’.]+)[^\p{L}]*$/u);
  return m ? m[1].toLowerCase().replace(/[.’']+$/, "") : "";
}

function previousChar(text: string, index: number): string {
  return text.slice(0, index).trimEnd().slice(-1);
}

/** Where a heading (possibly repeated) ends at the start of the text. */
function headingEnd(text: string, key: LabelSectionKey): number {
  const heading = HEADINGS[key];
  let start = 0;
  for (let i = 0; i < 4; i++) {
    const lead = text.slice(start).match(TRIM_START)?.[0].length ?? 0;
    const m = heading ? text.slice(start + lead).match(heading) : null;
    if (!m) break;
    start += lead + m[0].length;
  }
  return start;
}

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

/** Regions of the general warnings that repeat a section the label also has on its own. */
function repeatedRegions(text: string, present: Set<LabelSectionKey>): Span[] {
  const hits = [...text.matchAll(SUBHEADING_RE)].map((m) => ({ index: m.index!, phrase: m[0] }));
  const regions: Span[] = [];
  hits.forEach((hit, i) => {
    const key = SUBHEADINGS.find(([h]) => h.replace(/'/g, "’") === hit.phrase.replace(/'/g, "’"))?.[1];
    if (key && present.has(key)) regions.push([hit.index, hits[i + 1]?.index ?? text.length]);
  });
  return regions;
}

/** Split one section's tidied text into bullets. `exclude` spans are left out entirely. */
export function splitSection(key: LabelSectionKey, text: string, exclude: Span[] = []): string[] {
  const start = headingEnd(text, key);
  const cuts = new Set<number>([start, text.length]);
  const glyphs = GLYPH.test(text.slice(start));
  const add = (i: number) => {
    if (i > start && i < text.length) cuts.add(i);
  };

  for (const m of text.matchAll(GLYPHS_G)) add(m.index!);
  for (const m of text.matchAll(/(?<=\s)[-–](?=\p{L})/gu)) add(m.index!); // "-the common cold" dash bullets
  for (const m of text.matchAll(/[.!?](?=\s+["“(]?\p{Lu})/gu)) {
    const word = previousWord(text, m.index! + 1);
    if (!ABBREVIATIONS.has(word)) add(m.index! + 1 + (text.slice(m.index! + 1).match(/^\s+/)?.[0].length ?? 0));
  }
  const subheadingEnds = new Set<number>();
  for (const m of text.matchAll(SUBHEADING_RE)) {
    add(m.index!);
    subheadingEnds.add(m.index! + m[0].length + 1); // "Liver warning This product…": keep together
  }
  for (const m of text.matchAll(STARTERS)) if (!subheadingEnds.has(m.index!)) add(m.index!);
  if (!glyphs) {
    // Flattened lists: "…ask a doctor or pharmacist. if you are allergic…" — a new lowercase item.
    for (const m of text.matchAll(/[.!?](?=\s+\p{Ll})/gu)) {
      if (ABBREVIATIONS.has(previousWord(text, m.index! + 1))) continue;
      add(m.index! + 1 + (text.slice(m.index! + 1).match(/^\s+/)?.[0].length ?? 0));
    }
  }
  if (key === "purpose") for (const m of text.matchAll(/(?<=\p{Ll} )\p{Lu}/gu)) add(m.index!);
  if (!glyphs) {
    for (const re of ITEM_STARTS[key] ?? []) {
      for (const m of text.matchAll(re)) {
        if (NO_CUT_AFTER.has(previousWord(text, m.index!)) || previousChar(text, m.index!) === ":") continue;
        add(m.index!);
      }
    }
  }
  for (const [s, e] of exclude) {
    add(s);
    add(e);
  }

  const sorted = [...cuts].sort((a, b) => a - b);
  const bullets: string[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const [a, b] = [sorted[i], sorted[i + 1]];
    if (exclude.some(([s, e]) => a >= s && b <= e)) continue;
    const piece = text.slice(a, b);
    const lead = piece.match(TRIM_START)?.[0].length ?? 0;
    const bullet = piece.slice(lead).replace(TRIM_END, "");
    if (bullet.length < 2 || !/\p{L}/u.test(bullet)) continue;
    if (HEADINGS[key]?.test(bullet) && bullet.replace(HEADINGS[key]!, "").replace(TRIM_START, "") === "") continue;
    if (!bullets.includes(bullet)) bullets.push(bullet);
  }
  return bullets;
}

/** Every card section the label has, as bullets. Directions leave out the dosing table's flattened text. */
export function labelSections(label: FdaLabel): LabelSections {
  const texts = new Map<LabelSectionKey, string>();
  for (const key of LABEL_SECTION_KEYS) {
    const text = sectionText(label, key);
    if (text) texts.set(key, text);
  }
  const present = new Set(texts.keys());
  const sections: LabelSections = {};
  for (const [key, text] of texts) {
    const exclude: Span[] = [];
    if (key === "directions") {
      for (const html of (label.dosage_and_administration_table as unknown[] | undefined) ?? []) {
        if (typeof html !== "string") continue;
        const table = tableText(html);
        const at = table.length > 20 ? text.indexOf(table) : -1;
        if (at >= 0) exclude.push([at, at + table.length]);
      }
    }
    if (key === "warnings") exclude.push(...repeatedRegions(text, new Set([...present].filter((k) => k !== "warnings"))));
    const bullets = splitSection(key, text, exclude);
    if (bullets.length > 0) sections[key] = bullets;
  }
  return sections;
}
