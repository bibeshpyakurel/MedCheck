// Quick answers: the questions people most often ask about an OTC medicine, each answered with the FDA
// label's own bullets, picked by fixed keyword and heading rules. Pure; client-safe.
// Evidence only: nothing is reworded, summarized or computed; the dosing table is passed through whole
// and no row of it is ever singled out for a child. The only words of ours are the questions, the group
// headings (the label's own Drug Facts headings) and the fixed "not on the label" lines.
import { formatStrength } from "@/lib/domain/fields";
import type { Formulation, LabelSectionKey } from "@/lib/domain/schema";

export type QuickAnswerKey =
  | "uses"
  | "whats_in_it"
  | "adults"
  | "children"
  | "max_24h"
  | "other_medicines"
  | "alcohol"
  | "drowsiness"
  | "food"
  | "pregnancy"
  | "who_shouldnt"
  | "stop_use"
  | "allergies"
  | "overdose";

/** Bullets from one label section, under that section's Drug Facts heading. */
export type QuickAnswerGroup = { heading: string; bullets: string[] };

export type QuickAnswer = {
  key: QuickAnswerKey;
  question: string;
  /** The label's own words, verbatim, deduped within the answer. */
  bullets: string[];
  /**
   * Set when the answer draws on several label sections whose headings carry meaning ("Do not use" vs
   * "Ask a doctor before use if"): the same bullets, grouped. `bullets` is every group's bullets in order.
   */
  groups?: QuickAnswerGroup[];
  /** Only on "children": the full sanitized dosing table. */
  dosageTableHtml?: string;
  /** Only on alcohol, drowsiness and food, when the label says nothing about it. */
  notOnLabel?: string;
  /** Rows 1–6 and 14 show at once; 7–13 sit behind "More answers". */
  primary: boolean;
};

const NOT_ON_LABEL = {
  alcohol: "The label doesn't mention alcohol. Ask a pharmacist.",
  drowsiness: "The label doesn't mention drowsiness or driving. Ask a pharmacist.",
  food: "The label doesn't mention food. Ask a pharmacist.",
} as const;

/** The Drug Facts headings, as printed on labels (21 CFR 201.66), for grouped answers. */
export const LABEL_HEADINGS: Partial<Record<LabelSectionKey, string>> = {
  uses: "Uses",
  purpose: "Purpose",
  warnings: "Warnings",
  do_not_use: "Do not use",
  ask_doctor: "Ask a doctor before use if",
  ask_doctor_or_pharmacist: "Ask a doctor or pharmacist before use if",
  when_using: "When using this product",
  stop_use: "Stop use and ask a doctor if",
  pregnancy_or_breast_feeding: "If pregnant or breast-feeding",
  keep_out_of_reach: "Keep out of reach of children",
  directions: "Directions",
  inactive_ingredients: "Inactive ingredients",
};

/**
 * Sections searched for alcohol, drowsiness and food, in Drug Facts order. Left out on purpose: uses,
 * purpose and questions (marketing and symptoms: "fatigue or drowsiness", "overindulgence in food"),
 * inactive ingredients, storage and other information ("benzyl alcohol", "sugar alcohol content").
 */
const KEYWORD_SECTIONS: LabelSectionKey[] = [
  "warnings",
  "do_not_use",
  "ask_doctor",
  "ask_doctor_or_pharmacist",
  "when_using",
  "stop_use",
  "pregnancy_or_breast_feeding",
  "keep_out_of_reach",
  "directions",
];

// ---------------------------------------------------------------------------------------------
// Age split

const ADULT_START = /^(?:for\s+)?a\s?dults?\b/i;
const CHILD_START =
  /^(?:for\s+)?(?:children|child|kids|infants?|babies|toddlers)\b|^(?:persons\s+|people\s+)?under\s+\d+\s*(?:years?|yrs?)\b|^if (?:you are|your child is) under\s+\d+/i;
const CHILD_ANYWHERE = /\bchildren\s+(?:under|\d)|\b(?:in|for|to)\s+children\b/i;

/** An age line that sends the reader elsewhere: nothing after it continues it. */
const AGE_LINE_ENDS = /\b(?:ask|consult) a (?:doctor|dentist|physician)\b|\bdo not use\b(?! for more)|\bnot recommended\b/i;

type AgeGroup = "general" | "adults" | "children";

/**
 * The age group of each direction bullet, by the label's own phrase. A bullet that opens with
 * "adults…" is for adults; one that opens with "children…", "under 6 years…" or names "children under
 * …" is for children. A lowercase line right after an age line with a dose continues it ("children 6
 * to under 12 years: take 1 tablet …" then "do not take more than 5 tablets in 24 hours"); after
 * "… ask a doctor" or "… do not use" it doesn't. Everything else is general.
 */
function ageGroups(bullets: string[]): AgeGroup[] {
  let open: AgeGroup = "general"; // the age line later lowercase lines continue, if any
  return bullets.map((bullet) => {
    const b = bullet.trim();
    const age: AgeGroup | null = ADULT_START.test(b) ? "adults" : CHILD_START.test(b) || CHILD_ANYWHERE.test(b) ? "children" : null;
    if (age) {
      open = AGE_LINE_ENDS.test(b) ? "general" : age;
      return age;
    }
    if (open !== "general" && isFragment(b)) return open;
    open = "general";
    return "general";
  });
}

/** Direction bullets grouped by age (see `ageGroups`), each group in label order. */
export function splitDirectionsByAge(bullets: string[]): { general: string[]; adults: string[]; children: string[] } {
  const out = { general: [] as string[], adults: [] as string[], children: [] as string[] };
  ageGroups(bullets).forEach((g, i) => out[g].push(bullets[i]));
  return out;
}

// ---------------------------------------------------------------------------------------------
// Dosing table (already sanitized to table tags): read only to quote its adult rows under Adults.

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

/** Each table row as cells; each cell as its printed lines (split at `<br>`). */
function tableRows(html: string): string[][][] {
  return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
    [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
      cell[1]
        .split(/<br\s*\/?>/i)
        .map((line) => tidy(decode(line.replace(/<[^>]*>/g, " "))))
        .filter(Boolean),
    ),
  );
}

/**
 * The table's adult rows as bullets: "<age cell>: <first line>", then the cell's further lines. Used
 * only when the directions bullets name no adults (the import keeps tabled directions out of them).
 */
function adultTableBullets(html: string | null): string[] {
  if (!html) return [];
  return tableRows(html).flatMap(([age, ...rest]) => {
    const who = tidy((age ?? []).join(" ")).replace(/\s*:$/, "");
    if (!ADULT_START.test(who)) return [];
    const lines = rest.flat();
    if (lines.length === 0) return [];
    return [`${who}: ${lines[0]}`, ...lines.slice(1)];
  });
}

// ---------------------------------------------------------------------------------------------
// Bullet selection

const hasText = (s: string) => s.trim() !== "";
const dedupeKey = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function dedupe(bullets: string[]): string[] {
  const seen = new Set<string>();
  return bullets.filter((b) => {
    const k = dedupeKey(b);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Dedupe across groups (first occurrence wins) and drop emptied groups. */
function dedupeGroups(groups: QuickAnswerGroup[]): QuickAnswerGroup[] {
  const seen = new Set<string>();
  return groups
    .map((g) => ({
      heading: g.heading,
      bullets: g.bullets.filter((b) => {
        const k = dedupeKey(b);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }),
    }))
    .filter((g) => g.bullets.length > 0);
}

/** A named warning that opens a block: "Liver warning", "Allergy alert:", "Stomach bleeding warning:". */
const WARNING_HEAD = /^[A-Z][A-Za-z'’ /-]{0,40}?\b(?:warning|alert)s?\b/;
/** A list item cut from its sentence ("3 or more alcoholic drinks every day …"). */
const isFragment = (s: string) => /^[a-z0-9]/.test(s.trim());
const startsSentence = (s: string) => /^[A-Z]/.test(s.trim());

/**
 * Indexes of `bullets` to quote for a match at `i`. In the warnings, a matched list item cut from its
 * sentence comes with the warning that opens its block and the sentence that leads into the list, so
 * "3 or more alcoholic drinks every day" reads under "Severe liver damage may occur if you take …".
 */
function withLeadIn(bullets: string[], i: number, section: LabelSectionKey): number[] {
  if (section !== "warnings" || !isFragment(bullets[i])) return [i];
  let lead = -1;
  let head = -1;
  for (let j = i - 1; j >= 0 && i - j <= 8; j--) {
    if (lead === -1 && startsSentence(bullets[j])) lead = j;
    if (WARNING_HEAD.test(bullets[j])) {
      head = j;
      break;
    }
  }
  return [...new Set([head, lead, i].filter((n) => n >= 0))].sort((a, b) => a - b);
}

type Sections = Partial<Record<LabelSectionKey, string[]>>;

/** Full Drug Facts headings that, opening a bullet, mean the import ran one section into the next. */
const SECTION_OPENERS: [LabelSectionKey, RegExp][] = [
  ["ask_doctor_or_pharmacist", /^ask a doctor or pharmacist before use\b/i],
  ["ask_doctor", /^ask a doctor before use\b/i],
  ["when_using", /^when using this product\b/i],
  ["stop_use", /^stop use and ask a doctor\b/i],
  ["pregnancy_or_breast_feeding", /^if pregnant or breast[- ]?feeding\b/i],
  ["keep_out_of_reach", /^keep (?:this and all drugs )?out of (?:the )?reach of children\b/i],
];
/** The narrow sections where such a heading can't be an ordinary sentence. */
const REPAIRABLE: LabelSectionKey[] = ["do_not_use", "ask_doctor", "ask_doctor_or_pharmacist", "when_using", "stop_use", "pregnancy_or_breast_feeding"];

/**
 * The label's sections, or for rows imported before `labelSections` existed, the older fields. A
 * bullet that opens with another section's heading ("Stop use and ask a doctor if …" filed under "Ask
 * a doctor or pharmacist") moves, with the bullets after it, to that section; nothing is reworded.
 */
function sectionsOf(f: Formulation): Sections {
  const has = Object.values(f.labelSections).some((bullets) => bullets?.some(hasText));
  if (!has) {
    return {
      warnings: f.warningsQuotes.filter(hasText),
      directions: f.directionsText && hasText(f.directionsText) ? [f.directionsText] : [],
    };
  }
  const out: Sections = {};
  const push = (k: LabelSectionKey, b: string) => (out[k] ??= []).push(b);
  for (const [k, bullets] of Object.entries(f.labelSections) as [LabelSectionKey, string[] | undefined][]) {
    let target = k;
    for (const b of (bullets ?? []).filter(hasText)) {
      if (REPAIRABLE.includes(k)) {
        const opener = SECTION_OPENERS.find(([, re]) => re.test(b.trim()));
        if (opener && opener[0] !== k) target = opener[0];
      }
      push(target, b);
    }
  }
  return out;
}

/** Every bullet of `sections` that `matches`, grouped by section, with warnings' lead-ins. */
function search(
  s: Sections,
  keys: LabelSectionKey[],
  matches: (bullet: string, section: LabelSectionKey, index: number) => boolean,
): QuickAnswerGroup[] {
  return keys.flatMap((key) => {
    const bullets = s[key] ?? [];
    const picked = new Set<number>();
    bullets.forEach((b, i) => {
      if (matches(b, key, i)) for (const n of withLeadIn(bullets, i, key)) picked.add(n);
    });
    if (picked.size === 0) return [];
    return [{ heading: LABEL_HEADINGS[key] ?? key, bullets: [...picked].sort((a, b) => a - b).map((n) => bullets[n]) }];
  });
}

const without = (text: string, noise: RegExp) => text.replace(noise, " ");

const ALCOHOL_NOISE =
  /\bsugar alcohols?\b|\balcohol[- ]?free\b|\b(?:contains )?no alcohol\b|\b(?:benzyl|cetyl|cetearyl|stearyl|polyvinyl|isopropyl|ethyl|denatured|dehydrated|lanolin|phenethyl|dichlorobenzyl|myristyl|oleyl|SD)\s+alcohol\b/gi;
const ALCOHOL = /\balcohol/i;
const DROWSINESS = /\bdrows\w*|\bsleepiness\b|\bsleepy\b|\bdriving\b|\bdrive a\b|\bmotor vehicle\b|\bmachinery\b/i;
const FOOD_NOISE = /\bswallowing food\b|\bmilk of magnesia\b|\bbreast[- ]?milk\b/gi;
const FOOD = /\b(?:food|foods|meals?|milk|empty stomach|juice)\b/i;
const OTHER_MEDICINES = /\bother\b[^.]*\bcontaining\b|^with (?:any )?other\b|\bMAOI\b|\bmonoamine oxidase\b/i;
const ALLERGY = /\ballerg/i;
const OVERDOSE = /\bpoison control\b|\bin case of (?:accidental )?overdose\b|\boverdose warning\b|\baccidentally swallowed\b|\bif swallowed\b/i;
const TWENTY_FOUR_HOURS = /\b24[- ]?(?:hours?|hrs?)\b/i;

/** Allergy alert blocks in the warnings: the alert and the lines after it, up to the next named warning. */
function allergyBlocks(warnings: string[]): Set<number> {
  const picked = new Set<number>();
  warnings.forEach((b, i) => {
    if (!/\ballerg\w*\s+alert\b/i.test(b)) return;
    picked.add(i);
    for (let j = i + 1; j < warnings.length && j - i <= 8 && !WARNING_HEAD.test(warnings[j]); j++) picked.add(j);
  });
  return picked;
}

// ---------------------------------------------------------------------------------------------

/** The 14 quick answers (spec §3) for one product, in order; empty rows left out except 7–9 and 14. */
export function quickAnswers(f: Formulation): QuickAnswer[] {
  const s = sectionsOf(f);
  const sec = (k: LabelSectionKey) => s[k] ?? [];
  const answers: QuickAnswer[] = [];

  const add = (key: QuickAnswerKey, question: string, primary: boolean, bullets: string[], extra: Partial<QuickAnswer> = {}) => {
    answers.push({ key, question, bullets: dedupe(bullets), primary, ...extra });
  };
  const addGrouped = (key: QuickAnswerKey, question: string, primary: boolean, groups: QuickAnswerGroup[], notOnLabel?: string) => {
    const g = dedupeGroups(groups);
    if (g.length > 0) answers.push({ key, question, bullets: g.flatMap((x) => x.bullets), groups: g, primary });
    else if (notOnLabel) answers.push({ key, question, bullets: [], notOnLabel, primary });
  };

  // 1. What is it for?
  if (sec("uses").length > 0) add("uses", "What is it for?", true, sec("uses"));

  // 2. What's in it?
  const inIt = [...f.activeIngredients.map((i) => `${i.name} ${formatStrength(i.strength)}`), ...sec("purpose")];
  if (inIt.length > 0) add("whats_in_it", "What's in it?", true, inIt);

  // 3–4. How much, and how often? Adults / Children.
  // General lines show with the adults' (in label order); a heading says "Adults" only when the label does.
  const directions = sec("directions");
  const ages = ageGroups(directions);
  const labelledAdults = ages.includes("adults");
  const fromTable = labelledAdults ? [] : adultTableBullets(f.dosageTableHtml);
  const adults = [...directions.filter((_, i) => ages[i] !== "children"), ...fromTable];
  const children = directions.filter((_, i) => ages[i] === "children");
  const adultsQuestion = labelledAdults || fromTable.length > 0 ? "How much, and how often? — Adults" : "How much, and how often?";
  if (adults.length > 0) add("adults", adultsQuestion, true, adults);
  if (children.length > 0 || f.dosageTableHtml) {
    add("children", "How much, and how often? — Children", true, children, f.dosageTableHtml ? { dosageTableHtml: f.dosageTableHtml } : {});
  }

  // 5. Most in 24 hours.
  const max24 =
    f.max24hText && hasText(f.max24hText)
      ? [f.max24hText]
      : // Children's limits stay under Children, beside the age they belong to.
        adults.filter((b) => TWENTY_FOUR_HOURS.test(b));
  if (max24.length > 0) add("max_24h", "Most in 24 hours", true, max24);

  // 6. Taking other medicines?
  addGrouped(
    "other_medicines",
    "Taking other medicines?",
    true,
    search(s, KEYWORD_SECTIONS, (b, key) => key === "ask_doctor_or_pharmacist" || OTHER_MEDICINES.test(b.trim())),
  );

  // 7–9. Alcohol, drowsiness, food: every mention, or the fixed "not on the label" line.
  const mentions = (re: RegExp, noise?: RegExp) => search(s, KEYWORD_SECTIONS, (b) => re.test(noise ? without(b, noise) : b));
  addGrouped("alcohol", "Alcohol", false, mentions(ALCOHOL, ALCOHOL_NOISE), NOT_ON_LABEL.alcohol);
  addGrouped("drowsiness", "Drowsiness and driving", false, mentions(DROWSINESS), NOT_ON_LABEL.drowsiness);
  addGrouped("food", "With food?", false, mentions(FOOD, FOOD_NOISE), NOT_ON_LABEL.food);

  // 10. Pregnant or breastfeeding.
  if (sec("pregnancy_or_breast_feeding").length > 0) add("pregnancy", "Pregnant or breastfeeding", false, sec("pregnancy_or_breast_feeding"));

  // 11. Who shouldn't take it.
  addGrouped("who_shouldnt", "Who shouldn't take it", false, search(s, ["do_not_use", "ask_doctor"], () => true));

  // 12. When to stop and call a doctor.
  if (sec("stop_use").length > 0) add("stop_use", "When to stop and call a doctor", false, sec("stop_use"));

  // 13. Allergies: allergy alerts and allergy lines, then the inactive ingredients.
  const alerts = allergyBlocks(sec("warnings"));
  addGrouped("allergies", "Allergies", false, [
    ...search(s, KEYWORD_SECTIONS, (b, key, i) => ALLERGY.test(b) || (key === "warnings" && alerts.has(i))),
    { heading: LABEL_HEADINGS.inactive_ingredients!, bullets: sec("inactive_ingredients") },
  ]);

  // 14. Took too much? Always shown: the card adds Poison Control's number to whatever the label says.
  const overdose = [...KEYWORD_SECTIONS, "other_information" as const].flatMap((k) =>
    // Not "(see overdose warning)" pointers, nor a bare "Overdose warning" heading line.
    sec(k).filter((b) => OVERDOSE.test(b) && !/\bsee overdose\b/i.test(b) && !/^overdose warning\W*$/i.test(b.trim())),
  );
  add("overdose", "Took too much?", true, overdose);

  return answers;
}
