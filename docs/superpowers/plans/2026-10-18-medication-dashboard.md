# Medicine Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the medicine card's Quick answers list with a dashboard (ingredient card, uses tiles, directions by form and age with marked amounts and times, open warning cards, Good to know, source and status), plus a Quick View / Original FDA label tab switch. All of it stays in the label's own words.

**Architecture:** A pure view model, `medicationFacts(f)` in `src/lib/medication-facts.ts`, arranges a `Formulation`'s label bullets into the dashboard's sections. Every piece of text is a `LabelLine` that points at the raw bullet it came from. Small server-safe components render it. Two client pieces handle state: the card's tabs and the per-form directions switch. No schema change, no data change.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, shadcn `base-nova` (Base UI) `Tabs`, lucide-react, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-18-medication-dashboard-design.md`

## Global Constraints

- Every sentence shown is a label bullet, whole and verbatim, or a verbatim piece of one. Only headings, captions and the fixed "not on the label" lines are ours.
- Highlighting marks words in place: never remove, move or rewrite them. No dose, volume, schedule or age is computed or inferred. No "safe", no green.
- The children's dosing table is shown whole, no row highlighted, with the existing `DosingTable` caption.
- No "FDA Approved" or "FDA Verified" wording.
- `src/lib/domain/schema.ts` is not touched.
- Phone-first, tap targets ≥ 44 px (`min-h-11`/`h-11`), light and dark via the existing tokens (`bg-accent`, `text-accent-foreground`, `bg-finding-surface`, `text-finding-foreground`, `border-finding/40`, `bg-surface`).
- shadcn here is Base UI: compose with `render`, no `asChild`.
- Pure logic gets Vitest tests next to it, written first.
- Before pushing: `npm run lint && npm run typecheck && npm test && npm run build`.
- Commit messages are conventional (`feat:`, `test:`, `docs:`), ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File map

| File | Responsibility |
|---|---|
| `src/lib/quick-answers.ts` (modify) | export `ageOf()`, `ageGroups()`, `WARNING_HEAD` for reuse |
| `src/lib/medication-facts.ts` (create) | `medicationFacts()`, `markRanges()`, `resolveRef()`, `isDailyLimit()`, `STATUS_TEXT`, types |
| `src/lib/medication-facts.test.ts` (create) | rules, plus the traceability invariant over all fixture labels |
| `src/components/medicine-card/label-parts.tsx` (modify) | + `SectionHeading`, `MarkedLine`, `SourceLinks` |
| `src/components/medicine-card/medicine-card.tsx` (rewrite) | header, tabs, footer |
| `src/components/medicine-card/medicine-card-tabs.tsx` (create, client) | Quick View / Original tabs, `ShowOriginalButton` |
| `src/components/medicine-card/quick-view.tsx` (create) | composes the Quick View sections |
| `src/components/medicine-card/ingredient-hero.tsx` (create) | active ingredient card |
| `src/components/medicine-card/uses-grid.tsx` (create) | What it's for |
| `src/components/medicine-card/label-directions.tsx` (create) | Label directions section |
| `src/components/medicine-card/direction-block.tsx` (create) | one form's segments (general / age cards), the 24-hour limit card |
| `src/components/medicine-card/direction-forms.tsx` (create, client) | the per-form switch |
| `src/components/medicine-card/warning-cards.tsx` (create) | Important warnings + Took too much? |
| `src/components/medicine-card/good-to-know.tsx` (create) | Good to know tiles |
| `src/components/medicine-card/source-status.tsx` (create) | Source and status |
| `src/components/medicine-card/original-label.tsx` (create) | Original FDA label tab |
| `src/components/medicine-card/quick-answers.tsx` (delete) | replaced |
| `e2e/medcheck.spec.ts` (modify) | "Quick answers" assertions → tabs |
| `AGENTS.md`, the spec (modify) | code map, spec refinements found while planning |

---

### Task 1: Export the age and warning-heading rules from quick-answers

**Files:**
- Modify: `src/lib/quick-answers.ts` (the "Age split" block, about lines 78-125; `WARNING_HEAD`, about line 200)
- Test: `src/lib/quick-answers.test.ts`

**Interfaces:**
- Produces: `export type AgeGroup = "general" | "adults" | "children"`, `export function ageOf(bullet: string): "adults" | "children" | null`, `export function ageGroups(bullets: string[]): AgeGroup[]`, `export const WARNING_HEAD: RegExp`.

- [ ] **Step 1: Write the failing test** (append to `src/lib/quick-answers.test.ts`, and add `ageOf, ageGroups` to its import from `./quick-answers`)

```ts
describe("ageOf / ageGroups", () => {
  it("names the age group a line opens by the label's own phrase", () => {
    expect(ageOf("adults and children 12 years and over: take 1 tablet every 4 to 6 hours")).toBe("adults");
    expect(ageOf("children under 12 years: ask a doctor")).toBe("children");
    expect(ageOf("shake well before using")).toBeNull();
  });

  it("a lowercase line continues the age line before it; a capitalized one doesn't", () => {
    expect(ageGroups(["adults: take 1 tablet", "do not exceed 6 tablets in 24 hours", "Do not chew."])).toEqual(["adults", "adults", "general"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/quick-answers.test.ts`
Expected: FAIL, because `ageOf` is not exported.

- [ ] **Step 3: Implement.** In `src/lib/quick-answers.ts`, change `type AgeGroup` to `export type AgeGroup`, add `ageOf`, make `ageGroups` use it and export it, and export `WARNING_HEAD`:

```ts
export type AgeGroup = "general" | "adults" | "children";

/** The age group a direction bullet opens by its own phrase ("adults and children 12 years and over: …"), or null. */
export function ageOf(bullet: string): "adults" | "children" | null {
  const b = bullet.trim();
  return ADULT_START.test(b) ? "adults" : CHILD_START.test(b) || CHILD_ANYWHERE.test(b) ? "children" : null;
}

export function ageGroups(bullets: string[]): AgeGroup[] {
  let open: AgeGroup = "general"; // the age line later lowercase lines continue, if any
  return bullets.map((bullet) => {
    const b = bullet.trim();
    const age = ageOf(b);
    if (age) {
      open = AGE_LINE_ENDS.test(b) ? "general" : age;
      return age;
    }
    if (open !== "general" && isFragment(b)) return open;
    open = "general";
    return "general";
  });
}
```

`ageGroups` uses `isFragment`, which is declared later in the file as a `const`. That's fine: it is only called at runtime, after the module has initialized. Change `const WARNING_HEAD =` to `export const WARNING_HEAD =`. Keep the existing doc comment on `ageGroups`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/quick-answers.test.ts`
Expected: PASS (new and existing).

- [ ] **Step 5: Commit**

```bash
git add src/lib/quick-answers.ts src/lib/quick-answers.test.ts
git commit -m "refactor(card): export the age and warning-heading rules for reuse"
```

---

### Task 2: `medicationFacts()`: types, header, status, ingredient card, source

**Files:**
- Create: `src/lib/medication-facts.ts`
- Test: `src/lib/medication-facts.test.ts`

**Interfaces:**
- Consumes: `formatStrength(s: Strength): string` from `@/lib/domain/fields`; `Formulation`, `LabelSectionKey`, `SourceLink` from `@/lib/domain/schema`.
- Produces (used by every later task):
  ```ts
  export type LabelSource = LabelSectionKey | "directions_text" | "max_24h_text" | "warnings_quotes";
  export type LabelRef = { source: LabelSource; index: number };
  export type LabelLine = { text: string; ref: LabelRef; marks?: [number, number][] };
  export type StatusKind = "fictional" | "hand_checked" | "fda_published";
  export const STATUS_TEXT: Record<StatusKind, string>;
  export function resolveRef(f: Formulation, ref: LabelRef): string | null;
  export function medicationFacts(f: Formulation): MedicationFacts;
  ```
  `MedicationFacts` grows over Tasks 3-6. Its final shape is in Task 6.

- [ ] **Step 1: Write the failing test** (`src/lib/medication-facts.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { FICTIONAL_FORMULATIONS } from "@/data/fictional-formulations";
import type { Formulation } from "@/lib/domain/schema";
import labels from "./__fixtures__/quick-answers-labels.json";
import { medicationFacts, resolveRef, STATUS_TEXT } from "./medication-facts";

// Real catalog rows (live import, October 2026), copied verbatim.
const L = labels as unknown as Record<keyof typeof labels, Formulation>;
const calmora: Formulation = { ...FICTIONAL_FORMULATIONS[0], id: "calmora-a" };

describe("header and status", () => {
  it("is fictional, hand-checked, or FDA-published, in that order of precedence", () => {
    expect(medicationFacts(calmora).header.status).toBe("fictional");
    expect(medicationFacts({ ...L.advil, reviewed: true }).header.status).toBe("hand_checked");
    expect(medicationFacts(L.advil).header.status).toBe("fda_published");
    expect(STATUS_TEXT.fda_published).toBe("FDA-published label · not hand-checked");
  });

  it("names the product, each ingredient with strength, the labeler, date and form", () => {
    expect(medicationFacts(L.advil).header).toEqual({
      name: "ADVIL",
      ingredients: ["Ibuprofen 200 mg per tablet"],
      labeler: "Haleon US Holdings LLC",
      labelDate: "2026-03-12",
      dosageForm: "tablet",
      status: "fda_published",
    });
  });
});

describe("ingredient card", () => {
  it("splits each strength into its amount and what it is per", () => {
    expect(medicationFacts(L.advil).hero.ingredients).toEqual([{ name: "Ibuprofen", amount: "200 mg", per: "per tablet" }]);
    expect(medicationFacts(L.childrensTylenol).hero.ingredients[0]).toMatchObject({ amount: "160 mg", per: "per 5 mL" });
  });

  it("quotes the label's Purpose lines", () => {
    expect(medicationFacts(L.advil).hero.purposes.map((l) => l.text)).toEqual(["Pain reliever/Fever reducer"]);
    expect(medicationFacts(L.advil).hero.purposes[0].ref).toEqual({ source: "purpose", index: 0 });
  });
});

describe("resolveRef", () => {
  it("returns the raw text a ref points at", () => {
    expect(resolveRef(L.advil, { source: "uses", index: 1 })).toBe("toothache");
    expect(resolveRef(L.advil, { source: "max_24h_text", index: 0 })).toBe(L.advil.max24hText);
    expect(resolveRef(L.advil, { source: "warnings_quotes", index: 0 })).toBe(L.advil.warningsQuotes[0]);
    expect(resolveRef(L.advil, { source: "uses", index: 99 })).toBeNull();
  });
});

describe("source", () => {
  it("carries the set ID, NDCs and links", () => {
    expect(medicationFacts(L.advil).source).toEqual({
      kind: "openfda",
      setId: "1a665e64-9f30-be37-4a83-38789f1f1e89",
      ndcs: ["00573016520"],
      links: L.advil.sourceLinks,
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/medication-facts.test.ts`
Expected: FAIL, because `./medication-facts` does not exist.

- [ ] **Step 3: Implement** (`src/lib/medication-facts.ts`)

```ts
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

/** Rows imported before `labelSections` existed carry only `directionsText` and `warningsQuotes`. */
function hasSections(f: Formulation): boolean {
  return Object.values(f.labelSections).some((bullets) => bullets?.some(hasText));
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
```

`hasSections` is used from Task 4 on. If lint flags it as unused now, leave it out here and add it in Task 4.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/medication-facts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/medication-facts.ts src/lib/medication-facts.test.ts
git commit -m "feat(card): medicationFacts() view model: header, status, ingredient card, source"
```

---

### Task 3: Uses → groups of tiles with icons

**Files:**
- Modify: `src/lib/medication-facts.ts`
- Test: `src/lib/medication-facts.test.ts`

**Interfaces:**
- Produces: `export type UseIcon = "zap" | "thermometer" | "snowflake" | "wind" | "moon" | "flame" | "activity" | "dot"`, `export type UseTile = LabelLine & { icon: UseIcon }`, `export type UseGroup = { lead: LabelLine | null; tiles: UseTile[] }`, `MedicationFacts.uses: UseGroup[]`.

- [ ] **Step 1: Write the failing test** (append)

```ts
describe("uses", () => {
  const texts = (g: { tiles: { text: string }[] }) => g.tiles.map((t) => t.text);

  it("Advil: one list under its lead, then fever on its own", () => {
    const u = medicationFacts(L.advil).uses;
    expect(u.map((g) => g.lead?.text ?? null)).toEqual(["temporarily relieves minor aches and pains due to:", null]);
    expect(texts(u[0])).toEqual(["headache", "toothache", "backache", "menstrual cramps", "the common cold", "muscular aches", "minor pain of arthritis"]);
    expect(texts(u[1])).toEqual(["temporarily reduces fever"]);
    expect(u[0].tiles.map((t) => t.icon)).toEqual(["zap", "activity", "activity", "activity", "snowflake", "activity", "activity"]);
    expect(u[1].tiles[0].icon).toBe("thermometer");
  });

  it("Children's Tylenol: each colon starts a list; a leading list glyph is dropped", () => {
    const u = medicationFacts(L.childrensTylenol).uses;
    expect(u.map((g) => g.lead?.text)).toEqual(["temporarily:", "relieves minor aches and pains due to:"]);
    expect(texts(u[0])).toEqual(["reduces fever"]);
    expect(texts(u[1])).toEqual(["the common cold", "flu", "headache", "sore throat", "toothache"]);
  });

  it("Benadryl: a second lead starts a second list", () => {
    const u = medicationFacts(L.benadrylLiquid).uses;
    expect(u.map((g) => g.lead?.text)).toEqual([
      "temporarily relieves these symptoms due to hay fever or other upper respiratory allergies:",
      "temporarily relieves these symptoms due to the common cold:",
    ]);
    expect(texts(u[1])).toEqual(["runny nose", "sneezing"]);
    expect(u[1].tiles.map((t) => t.icon)).toEqual(["wind", "wind"]);
  });

  it("a Uses bullet with no colon is one tile, verbatim (Pepcid)", () => {
    const u = medicationFacts(L.pepcidAcMax).uses;
    expect(u).toHaveLength(1);
    expect(u[0].lead).toBeNull();
    expect(texts(u[0])).toEqual(L.pepcidAcMax.labelSections.uses);
    expect(u[0].tiles[0].icon).toBe("flame");
  });

  it("a label without Uses has no groups", () => {
    expect(medicationFacts({ ...L.advil, labelSections: {} }).uses).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/medication-facts.test.ts`
Expected: FAIL, because `uses` is undefined.

- [ ] **Step 3: Implement.** Add to `src/lib/medication-facts.ts`: the types (next to the others), `uses: UseGroup[]` in `MedicationFacts`, the code below, and `uses: useGroups(f),` in `medicationFacts()`.

```ts
export type UseIcon = "zap" | "thermometer" | "snowflake" | "wind" | "moon" | "flame" | "activity" | "dot";
export type UseTile = LabelLine & { icon: UseIcon };
/** `lead` is the label's words before its list ("temporarily relieves minor aches and pains due to:"). */
export type UseGroup = { lead: LabelLine | null; tiles: UseTile[] };
```

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/medication-facts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/medication-facts.ts src/lib/medication-facts.test.ts
git commit -m "feat(card): Uses as groups of tiles, verbatim, with decorative icons"
```

---

### Task 4: Directions: forms, age segments, marks, 24-hour limit, table

**Files:**
- Modify: `src/lib/medication-facts.ts`
- Test: `src/lib/medication-facts.test.ts`

**Interfaces:**
- Consumes: `ageOf`, `ageGroups` from `@/lib/quick-answers` (Task 1).
- Produces:
  ```ts
  export type DirectionSegment = { age: string | null; lines: LabelLine[] };
  export type DirectionBlock = { heading: LabelLine | null; segments: DirectionSegment[] };
  export type Directions = { blocks: DirectionBlock[]; max24h: LabelLine | null; dosageTableHtml: string | null };
  export function markRanges(text: string): [number, number][];
  export function isDailyLimit(text: string): boolean;
  // MedicationFacts.directions: Directions
  ```
  A block with `heading: null` holds lines shared by every form (shown above the form switch). Blocks with a heading are the label's per-form directions. There are always zero or at least two of them.

- [ ] **Step 1: Write the failing test** (append; add `markRanges` to the import from `./medication-facts`)

```ts
describe("directions", () => {
  const marked = (text: string) => markRanges(text).map(([s, e]) => text.slice(s, e));

  it("Advil: one block per form, each with its age cards in label order", () => {
    const d = medicationFacts(L.advil).directions;
    expect(d.blocks.map((b) => b.heading?.text)).toEqual(["Advil Tablets", "Advil Caplets", "Advil Gel Caplets"]);
    const tablets = d.blocks[0].segments;
    expect(tablets.map((s) => s.age)).toEqual([null, "Adults and children 12 years and over", "Children under 12 years"]);
    expect(tablets[1].lines.map((l) => l.text)).toEqual([
      "adults and children 12 years and over: take 1 tablet every 4 to 6 hours while symptoms persist if pain or fever does not respond to 1 tablet, 2 tablets may be used",
      "do not exceed 6 tablets in 24 hours, unless directed by a doctor",
    ]);
    // Already one of the directions lines, so not repeated.
    expect(d.max24h).toBeNull();
  });

  it("Pepcid: a capitalized line ends the adults' card, and label order is kept", () => {
    const s = medicationFacts(L.pepcidAcMax).directions.blocks[0].segments;
    expect(s.map((x) => x.age)).toEqual(["Adults and children 12 years and over", null, "Children under 12 years"]);
    expect(s[1].lines[0].text).toBe("Do not chew.");
  });

  it("Tylenol Extra Strength: directions live in the table; the 24-hour limit gets its own line", () => {
    const d = medicationFacts(L.tylenolExtraStrength).directions;
    expect(d.dosageTableHtml).toBe(L.tylenolExtraStrength.dosageTableHtml);
    expect(d.max24h?.text).toBe("do not take more than 6 tablets in 24 hours");
    expect(d.max24h?.ref).toEqual({ source: "max_24h_text", index: 0 });
    expect(marked(d.max24h!.text)).toEqual(["6 tablets in 24 hours"]);
  });

  it("Children's Tylenol: no age cards of its own; the table is passed whole", () => {
    const d = medicationFacts(L.childrensTylenol).directions;
    expect(d.blocks).toHaveLength(1);
    expect(d.blocks[0].segments.every((s) => s.age === null)).toBe(true);
    expect(d.dosageTableHtml).toBe(L.childrensTylenol.dosageTableHtml);
  });

  it("a row without sections shows its directions text as one unmarked line", () => {
    const d = medicationFacts(calmora).directions;
    expect(d.blocks).toEqual([{ heading: null, segments: [{ age: null, lines: [{ text: calmora.directionsText, ref: { source: "directions_text", index: 0 } }] }] }]);
  });

  it("marks amounts, intervals, 24-hour limits and referrals, nothing else", () => {
    expect(
      marked("adults and children 12 years and over: take 1 tablet every 4 to 6 hours while symptoms persist if pain or fever does not respond to 1 tablet, 2 tablets may be used"),
    ).toEqual(["1 tablet", "every 4 to 6 hours", "1 tablet", "2 tablets"]);
    expect(marked("do not exceed 6 gel caplets in 24 hours, unless directed by a doctor")).toEqual(["6 gel caplets in 24 hours"]);
    expect(marked("take 1 gel caplet every 4 to 6 hours")).toEqual(["1 gel caplet", "every 4 to 6 hours"]);
    expect(marked("children under 12 years: ask a doctor")).toEqual(["ask a doctor"]);
    expect(marked("repeat dose every 4 hours while symptoms last")).toEqual(["every 4 hours"]);
    expect(marked("do not give more than 5 times in 24 hours")).toEqual(["5 times in 24 hours"]);
    expect(marked("take only one dose (2 LiquiCaps) per day (24 hours)")).toEqual(["one dose", "2 LiquiCaps"]);
    expect(marked("shake well before using")).toEqual([]);
  });

  it("marks are sorted, inside the text, and never overlap", () => {
    for (const f of Object.values(L)) {
      for (const b of medicationFacts(f).directions.blocks) {
        for (const l of b.segments.flatMap((s) => s.lines)) {
          const m = l.marks ?? [];
          m.forEach(([s, e], i) => {
            expect(s).toBeGreaterThanOrEqual(0);
            expect(e).toBeLessThanOrEqual(l.text.length);
            expect(s).toBeLessThan(e);
            if (i > 0) expect(s).toBeGreaterThanOrEqual(m[i - 1][1]);
          });
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/medication-facts.test.ts`
Expected: FAIL, because `markRanges` is not exported and `directions` is undefined.

- [ ] **Step 3: Implement.** Add the import `import { ageGroups, ageOf } from "@/lib/quick-answers";`, the types, `directions: Directions` in `MedicationFacts`, the code below, and `directions: directions(f),` in `medicationFacts()`. Add `hasSections` here if it was left out in Task 2.

```ts
/** Label-order run of direction lines: general (`age` null), or one age line and the lines continuing it. */
export type DirectionSegment = { age: string | null; lines: LabelLine[] };
/** One form's directions ("Advil Caplets"); `heading` null holds lines every form shares. */
export type DirectionBlock = { heading: LabelLine | null; segments: DirectionSegment[] };
export type Directions = { blocks: DirectionBlock[]; max24h: LabelLine | null; dosageTableHtml: string | null };
```

```ts
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
  return new RegExp(String.raw`\b24\s*${HOURS}`, "i").test(text);
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
```

Note that the Calmora test expects `lines` without a `marks` key. The legacy line is built with `line()`, which adds none.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/medication-facts.test.ts`
Expected: PASS. If a mark expectation fails, fix the pattern, not the expectation. The expectations are the spec's examples.

- [ ] **Step 5: Commit**

```bash
git add src/lib/medication-facts.ts src/lib/medication-facts.test.ts
git commit -m "feat(card): directions by form and age, in label order, with amounts and times marked in place"
```

---

### Task 5: Warning cards and Took too much?

**Files:**
- Modify: `src/lib/medication-facts.ts`
- Test: `src/lib/medication-facts.test.ts`

**Interfaces:**
- Consumes: `WARNING_HEAD`, `LABEL_HEADINGS` from `@/lib/quick-answers`.
- Produces: `export type WarningCard = { kind: "headed" | "section"; title: string; section: LabelSectionKey | null; lead: LabelLine | null; lines: LabelLine[] }`, `MedicationFacts.warnings: WarningCard[]`, `MedicationFacts.overdose: LabelLine[]`.

- [ ] **Step 1: Write the failing test** (append)

```ts
describe("warnings", () => {
  const texts = (lines: { text: string }[]) => lines.map((l) => l.text);

  it("Advil: named warnings become cards titled as printed, then the Drug Facts sections", () => {
    const w = medicationFacts(L.advil).warnings;
    const headed = w.filter((c) => c.kind === "headed");
    expect(headed.map((c) => c.title)).toEqual(["Allergy alert", "Stomach bleeding warning", "Heart attack and stroke warning"]);
    expect(headed[1].lead?.text).toBe("This product contains an NSAID, which may cause severe stomach bleeding.");
    expect(texts(headed[1].lines)).toContain("take other drugs containing prescription or non-prescription NSAIDs [aspirin, ibuprofen, naproxen, or others]");
    expect(w.filter((c) => c.kind === "section").map((c) => c.section)).toEqual([
      "do_not_use",
      "ask_doctor",
      "ask_doctor_or_pharmacist",
      "when_using",
      "stop_use",
      "pregnancy_or_breast_feeding",
      "keep_out_of_reach",
    ]);
  });

  it("a heading without a colon still opens a card (Tylenol Extra Strength)", () => {
    const w = medicationFacts(L.tylenolExtraStrength).warnings.filter((c) => c.kind === "headed");
    expect(w.map((c) => c.title)).toEqual(["Liver warning", "Allergy alert"]);
    expect(w[0].lead?.text).toBe("This product contains acetaminophen.");
    expect(texts(w[0].lines)).toContain("3 or more alcoholic drinks every day while using this product");
  });

  it("the overdose warning moves to Took too much?, without its heading", () => {
    expect(texts(medicationFacts(L.tylenolExtraStrength).overdose)).toEqual([
      "In case of overdose, get medical help or contact a Poison Control Center right away. (1-800-222-1222) Quick medical attention is critical for adults as well as for children even if you do not notice any signs or symptoms.",
    ]);
  });

  it("Advil: Keep out of reach's overdose line moves to Took too much?; the heading-only line isn't repeated", () => {
    const x = medicationFacts(L.advil);
    expect(texts(x.overdose)).toEqual(["In case of overdose, get medical help or contact a Poison Control Center right away."]);
    const keep = x.warnings.find((c) => c.section === "keep_out_of_reach");
    expect(keep?.title).toBe("Keep out of reach of children");
    expect(keep?.lines).toEqual([]);
  });

  it("a row without sections shows its warning quotes as one Warnings card", () => {
    const legacy = { ...L.advil, labelSections: {} };
    const w = medicationFacts(legacy).warnings;
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ kind: "headed", title: "Warnings", section: null, lead: null });
    expect(texts(w[0].lines)).toEqual(L.advil.warningsQuotes);
  });

  it("a label with no overdose line still has Took too much? (empty; the card adds Poison Control)", () => {
    expect(medicationFacts({ ...L.advil, labelSections: { uses: ["headache"] }, warningsQuotes: [] }).overdose).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/medication-facts.test.ts`
Expected: FAIL, because `warnings` is undefined.

- [ ] **Step 3: Implement.** Extend the quick-answers import to `import { ageGroups, ageOf, LABEL_HEADINGS, WARNING_HEAD } from "@/lib/quick-answers";`. Add the type, `warnings: WarningCard[]; overdose: LabelLine[];` in `MedicationFacts`, the code below, and in `medicationFacts()`: `const { warnings, overdose } = warningCards(f);` then `warnings, overdose,` in the returned object.

```ts
/** `headed`: a named label warning ("Stomach bleeding warning"); `section`: a Drug Facts section card. */
export type WarningCard = { kind: "headed" | "section"; title: string; section: LabelSectionKey | null; lead: LabelLine | null; lines: LabelLine[] };
```

```ts
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
```

Check `LABEL_HEADINGS` in `src/lib/quick-answers.ts` holds entries for all seven `SECTION_CARDS` keys. If `when_using` or another key is missing, add it there with the label's printed heading ("When using this product").

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/medication-facts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/medication-facts.ts src/lib/medication-facts.test.ts src/lib/quick-answers.ts
git commit -m "feat(card): every warning as an open card titled as printed; overdose lines under Took too much?"
```

---

### Task 6: Good to know, plus the traceability invariant

**Files:**
- Modify: `src/lib/medication-facts.ts`
- Test: `src/lib/medication-facts.test.ts`

**Interfaces:**
- Consumes: `quickAnswers()` from `@/lib/quick-answers`.
- Produces: `export type GoodToKnowKey = "alcohol" | "food" | "drowsiness" | "allergies"`, `export type GoodToKnowTile = { key: GoodToKnowKey; title: string; bullets: string[]; notOnLabel: string | null }`. Final `MedicationFacts`:
  ```ts
  export type MedicationFacts = {
    header: { name: string; ingredients: string[]; labeler: string | null; labelDate: string | null; dosageForm: string; status: StatusKind };
    hero: { ingredients: { name: string; amount: string; per: string | null }[]; purposes: LabelLine[] };
    uses: UseGroup[];
    directions: Directions;
    warnings: WarningCard[];
    overdose: LabelLine[];
    goodToKnow: GoodToKnowTile[];
    source: { kind: Formulation["source"]; setId: string | null; ndcs: string[]; links: SourceLink[] };
  };
  ```

- [ ] **Step 1: Write the failing test** (append; add `type LabelLine` to the import)

```ts
describe("good to know", () => {
  const tiles = (f: Formulation) => Object.fromEntries(medicationFacts(f).goodToKnow.map((t) => [t.key, t]));

  it("has the four tiles in order", () => {
    expect(medicationFacts(L.advil).goodToKnow.map((t) => t.title)).toEqual(["Alcohol", "With food?", "Drowsiness and driving", "Allergies"]);
  });

  it("quotes the label when it speaks, else the fixed line (Advil)", () => {
    const g = tiles(L.advil);
    expect(g.food.bullets).toEqual(["take with food or milk if stomach upset occurs"]);
    expect(g.alcohol.bullets).toContain("have 3 or more alcoholic drinks every day while using this product");
    expect(g.drowsiness.bullets).toEqual([]);
    expect(g.drowsiness.notOnLabel).toBe("The label doesn't mention drowsiness or driving. Ask a pharmacist.");
  });

  it("Allergies leaves the inactive ingredients to the Original tab", () => {
    const g = tiles(L.advil);
    expect(g.allergies.bullets.some((b) => /acetylated monoglycerides/.test(b))).toBe(false);
    expect(g.allergies.bullets[0]).toMatch(/^Allergy alert/);
  });
});

describe("traceability", () => {
  const legacy: Formulation = { ...L.advil, id: "legacy", labelSections: {} };
  const cases = [...Object.entries(L), ["calmora", calmora], ["legacy advil", legacy]] as [string, Formulation][];

  function allLines(f: Formulation): LabelLine[] {
    const x = medicationFacts(f);
    return [
      ...x.hero.purposes,
      ...x.uses.flatMap((g) => [...(g.lead ? [g.lead] : []), ...g.tiles]),
      ...x.directions.blocks.flatMap((b) => [...(b.heading ? [b.heading] : []), ...b.segments.flatMap((s) => s.lines)]),
      ...(x.directions.max24h ? [x.directions.max24h] : []),
      ...x.warnings.flatMap((w) => [...(w.lead ? [w.lead] : []), ...w.lines]),
      ...x.overdose,
    ];
  }

  it.each(cases)("%s: every line is its source bullet, or a piece of it", (_, f) => {
    const lines = allLines(f);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      const raw = resolveRef(f, l.ref);
      expect(raw, JSON.stringify(l.ref)).not.toBeNull();
      expect(raw).toContain(l.text);
    }
  });

  it.each(cases)("%s: Good to know quotes only bullets the label has", (_, f) => {
    const everything = [...Object.values(f.labelSections).flat(), ...f.warningsQuotes, f.directionsText ?? ""];
    for (const t of medicationFacts(f).goodToKnow) for (const b of t.bullets) expect(everything).toContain(b);
  });

  it.each(cases)("%s: our words never say safe", (_, f) => {
    const x = medicationFacts(f);
    const ours = [STATUS_TEXT[x.header.status], ...x.warnings.map((w) => w.title), ...x.directions.blocks.flatMap((b) => b.segments.map((s) => s.age ?? "")), ...x.goodToKnow.map((t) => t.notOnLabel ?? "")];
    for (const s of ours) expect(s).not.toMatch(/\bsafe\b/i);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/medication-facts.test.ts`
Expected: FAIL, because `goodToKnow` is undefined.

- [ ] **Step 3: Implement.** Extend the import to `import { ageGroups, ageOf, LABEL_HEADINGS, quickAnswers, WARNING_HEAD } from "@/lib/quick-answers";`. Add the types, `goodToKnow: GoodToKnowTile[]` in `MedicationFacts`, the code below, and `goodToKnow: goodToKnow(f),` in `medicationFacts()`.

```ts
export type GoodToKnowKey = "alcohol" | "food" | "drowsiness" | "allergies";
/** The label's bullets mentioning the topic, or the fixed "The label doesn't mention …" line. */
export type GoodToKnowTile = { key: GoodToKnowKey; title: string; bullets: string[]; notOnLabel: string | null };
```

```ts
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
```

- [ ] **Step 4: Run all unit tests**

Run: `npm test`
Expected: PASS (whole suite). If the traceability test fails for a label, the rule that produced the line is wrong. Fix the rule; never loosen the invariant.

- [ ] **Step 5: Commit**

```bash
git add src/lib/medication-facts.ts src/lib/medication-facts.test.ts
git commit -m "feat(card): Good to know tiles; test that every dashboard line traces to its label bullet"
```

---

### Task 7: The dashboard components and the tabs

**Files:**
- Modify: `src/components/medicine-card/label-parts.tsx`
- Rewrite: `src/components/medicine-card/medicine-card.tsx`
- Create: `medicine-card-tabs.tsx`, `quick-view.tsx`, `ingredient-hero.tsx`, `uses-grid.tsx`, `label-directions.tsx`, `direction-block.tsx`, `direction-forms.tsx`, `warning-cards.tsx`, `good-to-know.tsx`, `source-status.tsx`, `original-label.tsx` (all in `src/components/medicine-card/`)
- Delete: `src/components/medicine-card/quick-answers.tsx`

**Interfaces:**
- Consumes: everything from `@/lib/medication-facts` (Tasks 2-6); `cardSections` from `@/lib/medicine-card`; `formatDocDate` from `@/lib/record-format`; `Tabs, TabsList, TabsTrigger, TabsContent` from `@/components/ui/tabs`; `cn` from `@/lib/utils`.
- Produces: `MedicineCard({ formulation, showTitle?, actions?: ReactNode, defaultTab?: CardTab })`, where `actions` and `defaultTab` are for the Compare feature. Also `export type CardTab = "quick" | "original"` from `medicine-card-tabs.tsx`. Existing call sites (`medicine-card-sheet.tsx`, `answer-result.tsx`) keep working unchanged.

Before writing, confirm every icon name below exists: `grep -o "export { default as \(Ban\|OctagonX\|MessageCircleQuestion\)[A-Za-z]*Icon" node_modules/lucide-react/dist/esm/lucide-react.js` (or check `node_modules/lucide-react/dist/lucide-react.d.ts`). If `MessageCircleQuestionIcon` is missing, use `MessageCircleQuestionMarkIcon`. If `CircleHelpIcon` is needed, use `CircleQuestionMarkIcon`.

- [ ] **Step 1: `label-parts.tsx`.** Add these imports and components (keep the existing ones):

```tsx
import { ExternalLinkIcon, PhoneIcon } from "lucide-react";
import { Fragment } from "react";
import type { SourceLink } from "@/lib/domain/schema";
import type { LabelLine } from "@/lib/medication-facts";

/** A dashboard section's heading and its one-line caption. */
export function SectionHeading({ id, title, caption }: { id: string; title: string; caption?: string }) {
  return (
    <div className="space-y-0.5">
      <h3 id={id} className="font-display text-lg font-semibold tracking-tight">
        {title}
      </h3>
      {caption && <p className="text-sm text-pretty text-muted-foreground">{caption}</p>}
    </div>
  );
}

/** A label line with its marked words highlighted where they stand; the text is never changed. */
export function MarkedLine({ line }: { line: LabelLine }) {
  const parts: { text: string; marked: boolean }[] = [];
  let at = 0;
  for (const [start, end] of line.marks ?? []) {
    if (start > at) parts.push({ text: line.text.slice(at, start), marked: false });
    parts.push({ text: line.text.slice(start, end), marked: true });
    at = end;
  }
  if (at < line.text.length) parts.push({ text: line.text.slice(at), marked: false });
  return (
    <>
      {parts.map((p, i) =>
        p.marked ? (
          <mark key={i} className="rounded-sm bg-accent px-0.5 font-semibold text-accent-foreground">
            {p.text}
          </mark>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  );
}

/** The card's sources (DailyMed, MedlinePlus), each opening in a new tab. */
export function SourceLinks({ links }: { links: SourceLink[] }) {
  if (links.length === 0) return null;
  return (
    <ul>
      {links.map((link) => (
        <li key={link.url}>
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {link.label}
            <ExternalLinkIcon aria-hidden className="size-3.5" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: `medicine-card-tabs.tsx`**

```tsx
"use client";

// Quick View | Original FDA label. Controlled, so Quick View's "See inactive ingredients" can switch tabs.
import { createContext, type ReactNode, useContext, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type CardTab = "quick" | "original";

const ShowOriginal = createContext<(() => void) | null>(null);

export function MedicineCardTabs({ quick, original, defaultTab = "quick" }: { quick: ReactNode; original: ReactNode; defaultTab?: CardTab }) {
  const [tab, setTab] = useState<CardTab>(defaultTab);
  const listRef = useRef<HTMLDivElement>(null);
  const showOriginal = () => {
    setTab("original");
    listRef.current?.scrollIntoView({ block: "start" });
  };
  return (
    <ShowOriginal.Provider value={showOriginal}>
      <Tabs value={tab} onValueChange={(value) => setTab(value as CardTab)} className="gap-5">
        <TabsList ref={listRef} className="grid w-full grid-cols-2 rounded-xl p-1 group-data-horizontal/tabs:h-12">
          <TabsTrigger value="quick" className="rounded-lg text-[0.9375rem]">
            Quick View
          </TabsTrigger>
          <TabsTrigger value="original" className="rounded-lg text-[0.9375rem]">
            Original FDA label
          </TabsTrigger>
        </TabsList>
        <TabsContent value="quick" className="text-base">
          {quick}
        </TabsContent>
        <TabsContent value="original" className="text-base">
          {original}
        </TabsContent>
      </Tabs>
    </ShowOriginal.Provider>
  );
}

/** Switches the card to the Original FDA label tab. Renders nothing outside a card. */
export function ShowOriginalButton({ children }: { children: ReactNode }) {
  const show = useContext(ShowOriginal);
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={show}
      className="inline-flex min-h-11 items-center text-left text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {children}
    </button>
  );
}
```

If `TabsList` doesn't forward `ref` (Base UI's `Tabs.List` accepts `ref` in React 19 as a prop), put the ref on a wrapping `<div>` instead.

- [ ] **Step 3: `ingredient-hero.tsx`**

```tsx
// The active ingredient card: name, amount large, what it is per, and the label's Purpose lines.
import type { MedicationFacts } from "@/lib/medication-facts";

export function IngredientHero({ hero, id }: { hero: MedicationFacts["hero"]; id: string }) {
  if (hero.ingredients.length === 0 && hero.purposes.length === 0) return null;
  return (
    <section aria-labelledby={id} className="space-y-4 rounded-2xl border border-primary/20 bg-accent p-5 text-accent-foreground">
      <h3 id={id} className="text-xs font-semibold tracking-wide uppercase">
        {hero.ingredients.length > 1 ? "Active ingredients" : "Active ingredient"}
      </h3>
      <ul className="space-y-4">
        {hero.ingredients.map((i, n) => (
          <li key={n} className="space-y-1">
            <p className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{i.name}</p>
            <p className="flex flex-wrap items-baseline gap-x-2 text-foreground">
              <span className="font-display text-4xl font-extrabold tracking-tight nums sm:text-5xl">{i.amount}</span>
              {i.per && <span className="text-base font-medium text-accent-foreground">{i.per}</span>}
            </p>
          </li>
        ))}
      </ul>
      {hero.purposes.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Purpose, as printed</p>
          <ul className="space-y-0.5 text-base font-semibold text-foreground">
            {hero.purposes.map((p, n) => (
              <li key={n}>{p.text}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: `uses-grid.tsx`**

```tsx
// What it's for: the label's Uses as tiles, word for word; the icons are decoration only.
import { ActivityIcon, CircleDotIcon, FlameIcon, type LucideIcon, MoonIcon, SnowflakeIcon, ThermometerIcon, WindIcon, ZapIcon } from "lucide-react";
import { SectionHeading } from "@/components/medicine-card/label-parts";
import type { UseGroup, UseIcon } from "@/lib/medication-facts";
import { cn } from "@/lib/utils";

const ICONS: Record<UseIcon, LucideIcon> = {
  zap: ZapIcon,
  thermometer: ThermometerIcon,
  snowflake: SnowflakeIcon,
  wind: WindIcon,
  moon: MoonIcon,
  flame: FlameIcon,
  activity: ActivityIcon,
  dot: CircleDotIcon,
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function UsesGrid({ groups, id }: { groups: UseGroup[]; id: string }) {
  if (groups.length === 0) return null;
  return (
    <section aria-labelledby={id} className="space-y-3">
      <SectionHeading id={id} title="What it's for" caption="The label's Uses, word for word." />
      {groups.map((g, n) => (
        <div key={n} className="space-y-2">
          {g.lead && <p className="text-[0.9375rem] font-semibold">{capitalize(g.lead.text)}</p>}
          <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {g.tiles.map((t, k) => {
              const Icon = ICONS[t.icon];
              return (
                <li
                  key={k}
                  className={cn(
                    "flex min-h-11 items-center gap-2.5 rounded-xl border bg-card p-3 text-[0.9375rem] leading-snug shadow-xs",
                    t.text.length > 40 && "col-span-2 md:col-span-3",
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Icon aria-hidden className="size-4" />
                  </span>
                  {t.text}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 5: `direction-block.tsx`** (no directive; used by server and client)

```tsx
// One form's directions: general lines and age cards in label order, marked words highlighted in place.
import { ClockIcon, InfoIcon, UsersIcon } from "lucide-react";
import { MarkedLine } from "@/components/medicine-card/label-parts";
import { type DirectionBlock, type DirectionSegment, isDailyLimit, type LabelLine } from "@/lib/medication-facts";
import { cn } from "@/lib/utils";

function LineIcon({ line, fallback: Fallback }: { line: LabelLine; fallback?: typeof InfoIcon }) {
  if (isDailyLimit(line.text)) return <ClockIcon aria-hidden className="mt-1 size-4 shrink-0 text-accent-foreground" />;
  return Fallback ? <Fallback aria-hidden className="mt-1 size-4 shrink-0 text-muted-foreground" /> : null;
}

function GeneralCard({ lines }: { lines: LabelLine[] }) {
  return (
    <ul className="divide-y rounded-2xl border bg-surface px-4">
      {lines.map((l, n) => (
        <li key={n} className="flex gap-2.5 py-3">
          <LineIcon line={l} fallback={InfoIcon} />
          <p className="text-[0.9375rem] leading-relaxed">
            <MarkedLine line={l} />
          </p>
        </li>
      ))}
    </ul>
  );
}

function AgeCard({ segment }: { segment: DirectionSegment }) {
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-xs">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-accent-foreground uppercase">
        <UsersIcon aria-hidden className="size-3.5" />
        {segment.age}
      </h4>
      <ul className="space-y-3">
        {segment.lines.map((l, n) => (
          <li key={n} className={cn("flex gap-2.5", n > 0 && "border-t border-dashed pt-3")}>
            <LineIcon line={l} />
            <p className="text-[0.9375rem] leading-relaxed">
              <MarkedLine line={l} />
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DirectionBlockView({ block }: { block: DirectionBlock }) {
  return (
    <div className="space-y-2.5">
      {block.segments.map((s, n) => (s.age ? <AgeCard key={n} segment={s} /> : <GeneralCard key={n} lines={s.lines} />))}
    </div>
  );
}

/** The label's 24-hour limit when no directions line already says it. */
export function LimitCard({ line }: { line: LabelLine }) {
  return (
    <div className="flex gap-2.5 rounded-2xl border bg-card p-4 shadow-xs">
      <ClockIcon aria-hidden className="mt-1 size-4 shrink-0 text-accent-foreground" />
      <p className="text-[0.9375rem] leading-relaxed">
        <MarkedLine line={line} />
      </p>
    </div>
  );
}
```

- [ ] **Step 6: `direction-forms.tsx`**

```tsx
"use client";

// The label's per-form directions ("Advil Tablets", "Advil Caplets"): one shown at a time, by the label's own sub-headings.
import { useId, useState } from "react";
import { DirectionBlockView } from "@/components/medicine-card/direction-block";
import type { DirectionBlock } from "@/lib/medication-facts";
import { cn } from "@/lib/utils";

export function DirectionForms({ blocks }: { blocks: DirectionBlock[] }) {
  const [shown, setShown] = useState(0);
  const labelId = useId();
  return (
    <div className="space-y-3">
      <p id={labelId} className="text-sm text-muted-foreground">
        This label has directions for:
      </p>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {blocks.map((b, n) => (
          <button
            key={n}
            type="button"
            aria-pressed={n === shown}
            onClick={() => setShown(n)}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              n === shown ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted",
            )}
          >
            {b.heading?.text}
          </button>
        ))}
      </div>
      <DirectionBlockView block={blocks[shown]} />
    </div>
  );
}
```

- [ ] **Step 7: `label-directions.tsx`**

```tsx
// Label directions: the label's own sentences by form and age, the 24-hour limit, and the dosing table whole.
import { DirectionBlockView, LimitCard } from "@/components/medicine-card/direction-block";
import { DirectionForms } from "@/components/medicine-card/direction-forms";
import { DosingTable, SectionHeading } from "@/components/medicine-card/label-parts";
import type { Directions } from "@/lib/medication-facts";

export function LabelDirections({ directions: d, id }: { directions: Directions; id: string }) {
  if (d.blocks.length === 0 && !d.max24h && !d.dosageTableHtml) return null;
  const shared = d.blocks.filter((b) => !b.heading);
  const forms = d.blocks.filter((b) => b.heading);
  return (
    <section aria-labelledby={id} className="space-y-3">
      <SectionHeading
        id={id}
        title="Label directions"
        caption="The label's own sentences. Highlights mark amounts and times; nothing is removed, reworded or worked out for you."
      />
      {shared.map((b, n) => (
        <DirectionBlockView key={n} block={b} />
      ))}
      {forms.length > 0 && <DirectionForms blocks={forms} />}
      {d.max24h && <LimitCard line={d.max24h} />}
      {d.dosageTableHtml && <DosingTable html={d.dosageTableHtml} />}
    </section>
  );
}
```

- [ ] **Step 8: `warning-cards.tsx`**

```tsx
// Important warnings: every one, open, titled as the label prints it; then Took too much? with Poison Control.
import { BanIcon, HeartIcon, InfoIcon, type LucideIcon, MessageCircleQuestionIcon, OctagonXIcon, PhoneIcon, PillIcon, ShieldAlertIcon, TriangleAlertIcon } from "lucide-react";
import { LabelBullets, PoisonControlButton, SectionHeading } from "@/components/medicine-card/label-parts";
import type { LabelSectionKey } from "@/lib/domain/schema";
import type { LabelLine, WarningCard } from "@/lib/medication-facts";

const SECTION_ICONS: Partial<Record<LabelSectionKey, LucideIcon>> = {
  do_not_use: BanIcon,
  ask_doctor: MessageCircleQuestionIcon,
  ask_doctor_or_pharmacist: PillIcon,
  when_using: InfoIcon,
  stop_use: OctagonXIcon,
  pregnancy_or_breast_feeding: HeartIcon,
  keep_out_of_reach: ShieldAlertIcon,
};

const texts = (lines: LabelLine[]) => lines.map((l) => l.text);

function Headed({ card }: { card: WarningCard }) {
  return (
    <div className="space-y-2.5 rounded-2xl border border-finding/40 bg-finding-surface p-4">
      <h4 className="flex items-center gap-2 font-semibold text-finding-foreground">
        <TriangleAlertIcon aria-hidden className="size-4.5 shrink-0" />
        {card.title}
      </h4>
      {card.lead && <p className="text-[0.9375rem] leading-relaxed">{card.lead.text}</p>}
      <LabelBullets bullets={texts(card.lines)} />
    </div>
  );
}

function Section({ card }: { card: WarningCard }) {
  const Icon = (card.section && SECTION_ICONS[card.section]) || InfoIcon;
  return (
    <div className="space-y-2.5 rounded-2xl border bg-card p-4 shadow-xs">
      <h4 className="flex items-center gap-2 font-semibold">
        <Icon aria-hidden className="size-4.5 shrink-0 text-muted-foreground" />
        {card.title}
      </h4>
      <LabelBullets bullets={texts(card.lines)} />
    </div>
  );
}

export function WarningCards({ warnings, overdose, id }: { warnings: WarningCard[]; overdose: LabelLine[]; id: string }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <SectionHeading
        id={id}
        title="Important warnings"
        caption="Every warning on the label, always open. They apply to everyone who uses this product; MedCheck doesn't rank them for you."
      />
      {warnings.map((w, n) => (w.kind === "headed" ? <Headed key={n} card={w} /> : <Section key={n} card={w} />))}
      <div className="space-y-3 rounded-2xl border border-foreground/25 bg-card p-4 shadow-xs">
        <h4 className="flex items-center gap-2 font-semibold">
          <PhoneIcon aria-hidden className="size-4.5 shrink-0" />
          Took too much?
        </h4>
        <LabelBullets bullets={texts(overdose)} />
        <PoisonControlButton />
      </div>
    </section>
  );
}
```

- [ ] **Step 9: `good-to-know.tsx`**

```tsx
// Good to know: alcohol, food, drowsiness and allergies, by the label's own lines or the fixed "doesn't mention" line.
import { LabelBullets, SectionHeading } from "@/components/medicine-card/label-parts";
import { ShowOriginalButton } from "@/components/medicine-card/medicine-card-tabs";
import type { GoodToKnowTile } from "@/lib/medication-facts";

export function GoodToKnow({ tiles, id }: { tiles: GoodToKnowTile[]; id: string }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <SectionHeading id={id} title="Good to know" caption="Every line on the label that mentions it." />
      <ul className="grid gap-2 sm:grid-cols-2">
        {tiles.map((t) => (
          <li key={t.key} className="space-y-1.5 rounded-xl border bg-card p-3.5 shadow-xs">
            <h4 className="text-sm font-semibold text-muted-foreground">{t.title}</h4>
            {t.bullets.length > 0 ? (
              <LabelBullets bullets={t.bullets} />
            ) : (
              t.notOnLabel && <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">{t.notOnLabel}</p>
            )}
            {t.key === "allergies" && <ShowOriginalButton>See inactive ingredients on the Original FDA label</ShowOriginalButton>}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 10: `source-status.tsx`**

```tsx
// Source and status: where the label came from and whether anyone checked it by hand.
import { SourceLinks } from "@/components/medicine-card/label-parts";
import { type MedicationFacts, STATUS_TEXT } from "@/lib/medication-facts";
import { formatDocDate } from "@/lib/record-format";

export function SourceStatus({ facts, id }: { facts: MedicationFacts; id: string }) {
  const { source, header } = facts;
  const date = formatDocDate(header.labelDate);
  return (
    <section aria-labelledby={id} className="space-y-3 rounded-2xl border bg-card p-4 shadow-xs">
      <h3 id={id} className="font-semibold">
        Source and status
      </h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Source</dt>
        <dd>{source.kind === "fictional" ? "Fictional demo label" : "FDA label via openFDA"}</dd>
        {source.setId && (
          <>
            <dt className="text-muted-foreground">Set ID</dt>
            <dd className="font-mono text-xs break-all">{source.setId}</dd>
          </>
        )}
        {date && (
          <>
            <dt className="text-muted-foreground">Label date</dt>
            <dd>{date}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Status</dt>
        <dd>{STATUS_TEXT[header.status]}</dd>
      </dl>
      <SourceLinks links={source.links} />
    </section>
  );
}
```

- [ ] **Step 11: `original-label.tsx`**

```tsx
// Original FDA label: every Drug Facts section in label order, as published, with the full dosing table and the source.
import { DosingTable, LabelBullets, SourceLinks } from "@/components/medicine-card/label-parts";
import type { Formulation } from "@/lib/domain/schema";
import { cardSections } from "@/lib/medicine-card";
import { formatDocDate } from "@/lib/record-format";

export function OriginalLabel({ formulation: f }: { formulation: Formulation }) {
  const sections = cardSections(f);
  const id = (key: string) => `orig-${f.id}-${key}`;
  const date = formatDocDate(f.labelEffectiveDate);
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Every Drug Facts section as published, in label order. Nothing is reworded.</p>
      {sections.length > 0 && (
        <div className="divide-y rounded-2xl border bg-card px-4 shadow-xs sm:px-5">
          {sections.map((section) => (
            <section key={section.key} aria-labelledby={id(section.key)} className="space-y-3 py-5">
              <h3 id={id(section.key)} className="text-base font-semibold">
                {section.heading}
              </h3>
              <LabelBullets bullets={section.bullets} />
              {section.key === "directions" && f.dosageTableHtml && <DosingTable html={f.dosageTableHtml} />}
            </section>
          ))}
        </div>
      )}
      <section aria-labelledby={id("meta")} className="space-y-2 rounded-2xl border bg-card p-4 text-sm shadow-xs">
        <h3 id={id("meta")} className="font-semibold">
          Source
        </h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          {f.openfdaSetId && (
            <>
              <dt className="text-muted-foreground">openFDA set ID</dt>
              <dd className="font-mono text-xs break-all">{f.openfdaSetId}</dd>
            </>
          )}
          {f.ndcPackages.length > 0 && (
            <>
              <dt className="text-muted-foreground">NDC</dt>
              <dd className="font-mono text-xs break-all">{f.ndcPackages.join(", ")}</dd>
            </>
          )}
          {date && (
            <>
              <dt className="text-muted-foreground">Effective</dt>
              <dd>{date}</dd>
            </>
          )}
          {f.labelerName && (
            <>
              <dt className="text-muted-foreground">Labeler</dt>
              <dd>{f.labelerName}</dd>
            </>
          )}
        </dl>
        <SourceLinks links={f.sourceLinks} />
      </section>
    </div>
  );
}
```

- [ ] **Step 12: `quick-view.tsx`**

```tsx
// Quick View: the label's own words, arranged to read at a glance. No "use client".
import { GoodToKnow } from "@/components/medicine-card/good-to-know";
import { IngredientHero } from "@/components/medicine-card/ingredient-hero";
import { LabelDirections } from "@/components/medicine-card/label-directions";
import { SourceStatus } from "@/components/medicine-card/source-status";
import { UsesGrid } from "@/components/medicine-card/uses-grid";
import { WarningCards } from "@/components/medicine-card/warning-cards";
import type { MedicationFacts } from "@/lib/medication-facts";

export function QuickView({ facts, idPrefix }: { facts: MedicationFacts; idPrefix: string }) {
  const id = (key: string) => `${idPrefix}-${key}`;
  return (
    <div className="space-y-8">
      <IngredientHero hero={facts.hero} id={id("hero")} />
      <UsesGrid groups={facts.uses} id={id("uses")} />
      <LabelDirections directions={facts.directions} id={id("directions")} />
      <WarningCards warnings={facts.warnings} overdose={facts.overdose} id={id("warnings")} />
      <GoodToKnow tiles={facts.goodToKnow} id={id("good")} />
      <SourceStatus facts={facts} id={id("source")} />
    </div>
  );
}
```

- [ ] **Step 13: rewrite `medicine-card.tsx`**

```tsx
// The medicine card: a dashboard over the FDA label (Quick View) and the label as published (Original
// FDA label), in the label's own words throughout. Evidence only: no dose maths, no "safe", and the
// dosing table is shown in full with no row picked. No "use client": it renders on the server and inside
// the client sheet alike; the tabs and the per-form switch are client children.
import { BuildingIcon, CalendarIcon, InfoIcon, type LucideIcon, PillIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PoisonControlButton } from "@/components/medicine-card/label-parts";
import { type CardTab, MedicineCardTabs } from "@/components/medicine-card/medicine-card-tabs";
import { OriginalLabel } from "@/components/medicine-card/original-label";
import { QuickView } from "@/components/medicine-card/quick-view";
import type { Formulation } from "@/lib/domain/schema";
import { medicationFacts, STATUS_TEXT } from "@/lib/medication-facts";
import { formatDocDate } from "@/lib/record-format";

function Meta({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <Icon aria-hidden className="size-4 shrink-0" />
      {children}
    </li>
  );
}

/**
 * `showTitle={false}` when the container already shows the brand name (the sheet's sticky title).
 * `actions` sit under the status chip (Compare with my medicines); `defaultTab` opens on the Original label.
 * `dosageTableHtml` must arrive sanitized: `rowToFormulation()` does that on every catalog read.
 */
export function MedicineCard({
  formulation: f,
  showTitle = true,
  actions,
  defaultTab = "quick",
}: {
  formulation: Formulation;
  showTitle?: boolean;
  actions?: ReactNode;
  defaultTab?: CardTab;
}) {
  const facts = medicationFacts(f);
  const { header } = facts;
  const labelDate = formatDocDate(header.labelDate);

  return (
    <article className="space-y-6">
      <header className="space-y-3">
        {showTitle && <h2 className="font-display text-2xl font-semibold tracking-tight text-balance">{header.name}</h2>}
        {header.ingredients.length > 0 && (
          <ul className="space-y-1 text-base font-semibold nums">
            {header.ingredients.map((line, n) => (
              <li key={n}>{line}</li>
            ))}
          </ul>
        )}
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {header.labeler && <Meta icon={BuildingIcon}>{header.labeler}</Meta>}
          {labelDate && <Meta icon={CalendarIcon}>Label dated {labelDate}</Meta>}
          {header.dosageForm && <Meta icon={PillIcon}>{header.dosageForm.charAt(0).toUpperCase() + header.dosageForm.slice(1)}</Meta>}
        </ul>
        <p className="inline-flex items-center gap-1.5 rounded-full border bg-surface px-2.5 py-1 text-xs font-medium">
          <InfoIcon aria-hidden className="size-3.5" />
          {STATUS_TEXT[header.status]}
        </p>
        {actions}
      </header>

      <MedicineCardTabs
        defaultTab={defaultTab}
        quick={<QuickView facts={facts} idPrefix={`card-${f.id}`} />}
        original={<OriginalLabel formulation={f} />}
      />

      <footer>
        <PoisonControlButton />
      </footer>
    </article>
  );
}
```

- [ ] **Step 14: Delete `quick-answers.tsx`, then lint, typecheck and test**

```bash
git rm src/components/medicine-card/quick-answers.tsx
npm run lint && npm run typecheck && npm test
```
Expected: all pass. Fix any unused-import or type error the checks report (e.g. `ChevronDownIcon` no longer used).

- [ ] **Step 15: Commit**

```bash
git add src/components/medicine-card
git commit -m "feat(card): the medicine dashboard: Quick View and Original FDA label tabs"
```

---

### Task 8: e2e, docs, verify in a browser

**Files:**
- Modify: `e2e/medcheck.spec.ts` (the three `heading "Quick answers"` assertions near lines 395, 530, 551)
- Modify: `AGENTS.md` (spec list and code map)
- Modify: `docs/superpowers/specs/2026-10-18-medication-dashboard-design.md` (refinements made while planning)

- [ ] **Step 1: e2e.** Replace each `getByRole("heading", { name: "Quick answers" })` with `getByRole("tab", { name: "Quick View" })`. Change the comment at line 396 to `// "Took too much?" and the footer both carry Poison Control.` After that line, add:

```ts
    await card.getByRole("tab", { name: "Original FDA label" }).click();
    await expect(card.getByRole("tabpanel")).toContainText("Every Drug Facts section as published");
```

- [ ] **Step 2: AGENTS.md.**
  - Add `docs/superpowers/specs/2026-10-18-medication-dashboard-design.md` (the medicine card as a dashboard) to the opening "Read …" list.
  - Replace the `src/lib/quick-answers.ts` code-map entry with:
    `- \`src/lib/quick-answers.ts\` — \`quickAnswers(f)\`: label bullets picked by keyword/heading rules (never reworded); feeds the card's Good to know. Also the age rules (\`ageOf\`, \`ageGroups\`, \`splitDirectionsByAge\`) and \`WARNING_HEAD\`.`
  - Add after it:
    `- \`src/lib/medication-facts.ts\` — \`medicationFacts(f)\`: the medicine card's dashboard (ingredient card, uses tiles, directions by form and age with \`markRanges()\` highlights, warning cards, Good to know). Every line is a \`LabelLine\` whose \`ref\` points at its raw label bullet (\`resolveRef()\`); a test holds that for every fixture label. Rendered by \`src/components/medicine-card/\` (\`MedicineCard\`: Quick View / Original FDA label tabs; \`actions\` and \`defaultTab\` for callers).`

- [ ] **Step 3: Spec refinements** (in the dashboard spec):
  - In "Age groups", replace "General lines (no age) go in a muted card before the age cards, in label order." with "Lines stay in label order: each run of general lines (no age) is a muted card, and each age line starts a card its continuing lines join (Pepcid's \"Do not chew.\" ends the adults' card)."
  - In "Marks", replace the referral bullet with "a referral: `ask a doctor`, `consult a doctor`". Remove `do not use`, which marked Pepcid's "do not use more than 2 tablets" as a referral.
  - In §3, change "Good to know to 3 columns from `md:`" to "Good to know to 2 columns from `sm:`".

- [ ] **Step 4: Build, then look at it in a browser.** Run `npm run build`. Copy another worktree's `.env.local` (`cp ../ui-ux/.env.local .`; it is git-ignored). Start `npm run dev -- -p 3170` (a port of this worktree's own), sign in as a guest, and open a saved medicine's card. Follow the `verify-frontend-change` skill. Check, at 375 px and 1280 px, in light and dark:
  - Quick View: ingredient card, Uses tiles, directions with marks, the Advil form switch, warnings open, Good to know
  - "See inactive ingredients" switches to Original and scrolls to the tabs
  - Original: all sections and the dosing table
  - no console errors

  Delete the guest when done (menu → leave).

- [ ] **Step 5: e2e on this worktree's own ports.**

Run: `E2E_PORT=3171 FAKE_GEMINI_PORT=4971 npm run e2e`
Expected: PASS (the suite deletes its guest users). If Supabase's guest rate limit (about 30 an hour per IP, shared by every worktree) blocks it, say so rather than retrying in a loop.

- [ ] **Step 6: Commit**

```bash
git add e2e/medcheck.spec.ts AGENTS.md docs/superpowers/specs/2026-10-18-medication-dashboard-design.md
git commit -m "test(e2e): the card's tabs; docs: map the medicine dashboard"
```

---

### Task 9: Ship

- [ ] **Step 1:** `git fetch origin && git log --oneline HEAD..origin/dev`. If `dev` moved, `git merge origin/dev` and rerun `npm run lint && npm run typecheck && npm test && npm run build`.
- [ ] **Step 2:** `git push`, then `gh pr create --base dev --title "feat(card): the medicine dashboard" --body …`. The body says what changed, cites both specs, lists the validation that ran (with any skipped step named), and ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- [ ] **Step 3:** Wait for `verify` and `e2e` to pass. Merge only when they are green and the branch is up to date (`AGENTS.md` → Git).
