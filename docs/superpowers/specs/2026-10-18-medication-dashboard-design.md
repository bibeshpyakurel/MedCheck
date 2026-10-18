# MedCheck — Medicine dashboard: the FDA label at a glance

The medicine card stops being a list of questions over bullets and becomes a dashboard you can read in seconds: a big ingredient card, uses as tiles, directions grouped by age with the amounts and times highlighted, every warning open as a card, and the whole label one tab away. Every word on it is still the label's own.

Mockup (approved 2026-10-18): https://claude.ai/artifact/QKg4aPdmyeDoogDcWbCdww — screens 1 (Advil, Quick View and Original tab) and 2 (Children's Tylenol directions).

Where this spec and `2026-10-17-photo-answers-design.md` §3 disagree, this one wins: the 14-row Quick answers list is replaced by the dashboard below; its topics all survive (§4).

## 1. Scope

- One component, `MedicineCard`, everywhere it renders today: the medicine card sheet, the entry page's card button, and the photo pop-up's answer card.
- Pure presentation over the existing `Formulation`. **No schema change, no migration, no new data.**
- Out of scope: the **Compare with my medicines** button and flow (`2026-10-18-compare-with-my-medicines-design.md`; this spec leaves a header slot for it), the PDF report, the Medicines page, a broader reskin.

## 2. Boundaries (unchanged)

- Every sentence shown is a label bullet, whole and verbatim, or a verbatim piece of one (§5 Uses). Only headings, captions and the fixed "not on the label" lines are ours.
- Highlighting marks words in place; it never removes, moves or rewrites them. No dose, volume, schedule or age is computed or inferred. No "safe", no green.
- The children's dosing table is shown whole, no row highlighted, with "Dosing table, shown in full exactly as printed. MedCheck doesn't pick a row."
- No "FDA Approved" or "FDA Verified" badge.
- If a rule can't place a bullet with confidence, the bullet is shown as printed in label order, not guessed into a group.

## 3. Layout

```
Header         brand · ingredient + strength per ingredient · labeler · label date · dosage form
               status chip · [Compare with my medicines — Feature 2 slot]
Tabs           Quick View (default) | Original FDA label
Quick View     Active ingredient card → What it's for → Label directions →
               Important warnings → Good to know → Source and status
Original       every Drug Facts section in label order (today's cardSections()), dosing table,
               source metadata (set ID, NDCs, effective date, labeler)
Footer         Poison Control 1-800-222-1222 (tap-to-call), as today
```

Phone-first (the mockup is 390 px wide). At `sm:` and up the card keeps a single column inside the dialog. Uses go to 3 columns and Good to know to 3 columns from `md:`. Tap targets are at least 44 px. Light and dark both come from the existing tokens.

### Status chip

| Formulation | Chip |
|---|---|
| `isFictional` | "Fictional demo label, not a real product" |
| `reviewed` | "Hand-checked against the FDA label" |
| otherwise | "FDA-published label · not hand-checked" |

## 4. Where each Quick answer goes

| Old row | New home |
|---|---|
| What is it for? | What it's for (tiles) |
| What's in it? | Active ingredient card |
| Adults / Children / Most in 24 hours | Label directions |
| Taking other medicines? | "Ask a doctor or pharmacist before use if" card. "Do not use with other … containing" bullets stay in the card of the section they came from |
| Pregnant or breastfeeding · Who shouldn't take it · When to stop | Their warning cards |
| Took too much? | "Took too much?" card + Poison Control |
| Alcohol · Drowsiness and driving · With food? · Allergies | Good to know tiles (same keyword rules, same fixed "The label doesn't mention … Ask a pharmacist." lines) |

`quickAnswers()` stays as the source of the Good to know answers. The `QuickAnswers` component and the "More answers" disclosure are removed.

## 5. The view model: `src/lib/medication-facts.ts`

`medicationFacts(f: Formulation): MedicationFacts` is pure and client-safe, and built test-first. It is the only place the card's rules live, and the components only render what it returns.

Every displayed piece of label text is a `LabelLine`:

```ts
type LabelRef = { source: LabelSectionKey | "directions_text" | "max_24h_text" | "warnings_quotes"; index: number };
type LabelLine = {
  text: string;               // the label's words, verbatim (a whole bullet, or a piece of one for Uses)
  ref: LabelRef;              // which bullet it came from: traceability
  marks?: [number, number][]; // character ranges to highlight (Directions only)
};
```

Tests assert, for every fixture label, that each `LabelLine.text` is the bullet at `ref` (or a substring of it, for Uses items). That is the "traceable to source" guarantee.

### Active ingredient card

Each `activeIngredients` entry is shown with the name large, the strength's amount + unit huge, and the `per …` part (e.g. "per tablet") small. Under it come the label's `purpose` bullets, captioned "Purpose, as printed". Purposes stay one list: a label doesn't say which purpose belongs to which ingredient. With two or more ingredients, the card stacks one row per ingredient.

### What it's for (uses → tiles)

The `uses` bullets become groups of tiles:

1. A bullet containing a colon starts a group. The text up to and including the first colon is the group's lead ("temporarily relieves minor aches and pains due to:"). The rest is its first tile ("headache"). A leading list glyph (`-`, `•`) on a tile is dropped, as the import already does for bullets.
2. A following bullet without a colon joins the group, unless it starts with the lead's first word or with a Uses verb (`temporarily`, `relieves`, `reduces`, `helps`, `prevents`, `controls`). Then it is a standalone tile ("temporarily reduces fever").
3. A bullet before any group, or with no colon on a label that has none, is a standalone tile.
4. The lead is displayed with only its first letter capitalized. Tiles are verbatim.

Icons come from a fixed keyword map on the tile text (`USE_ICONS`): headache → `Zap`, fever → `Thermometer`, cold/flu → `Snowflake`, aches/pain/arthritis/backache → `Activity`, sneezing/runny nose/itchy → `Wind`, sleep → `Moon`, heartburn/acid/stomach → `Flame`. Anything else gets a neutral `CircleDot`. Icons are decorative (`aria-hidden`).

### Label directions

Built from `labelSections.directions`, or from `directionsText` as one line when the row predates sections (no grouping, no marks).

- **Forms.** Some labels print one block of directions per form ("Advil Tablets", "Advil Caplets", "Advil Gel Caplets"). A bullet of at most five words that starts with the brand name (case-insensitive) and contains no digit starts a form block. With two or more blocks, a segmented control ("This label has directions for:") switches between them. Its buttons carry the label's own sub-headings. With fewer than two, there is no control.
- **Age groups**, within a form, by the existing rules in `splitDirectionsByAge()`/`ageGroups()` (an age line, plus the lowercase lines that continue it). Each age line starts a card headed by its own age phrase (the text before its colon, first letter capitalized: "Adults and children 12 years and over", "Children under 12 years"). General lines (no age) go in a muted card before the age cards, in label order.
- **Marks** (fixed patterns, unit-tested; the text is never changed):
  - an amount with a unit: `1 tablet`, `2 caplets`, `5 mL`, `10 mL`, `1 teaspoon`
  - an interval: `every 4 to 6 hours`, `every 4 hours`
  - a 24-hour limit: `6 tablets in 24 hours`, `5 times in 24 hours`
  - a referral: `ask a doctor`, `do not use`

  Marks render as `<mark>` with weight and the accent surface, so they don't rely on color alone. A caption reads: "The label's own sentences. Highlights mark amounts and times; nothing is removed, reworded or worked out for you."
- **24-hour limit.** A line mentioning 24 hours is shown with a clock icon where it falls. `max24hText` is added as its own line only when no directions bullet already contains it.
- **Dosing table.** It is shown once, after the directions, whole, with the fixed caption. It is never inside an age card, and never highlighted.

### Important warnings

All open, never collapsed, in this order:

1. **Headed warnings** from `labelSections.warnings`. A bullet matching `<Title> warning:` or `<Title> alert:` (e.g. "Stomach bleeding warning: …", "Allergy alert: …", "Liver warning: …") starts an amber (`finding`) card titled with the label's heading. The rest of that bullet is the card's lead sentence, and the following non-headed bullets are its list. Bullets before the first headed one form a card titled "Warnings". An "Overdose warning" card is held back for step 3.
2. **Section cards**, neutral, each with the Drug Facts heading as printed (the `HEADINGS` map in `quick-answers.ts`): Do not use · Ask a doctor before use if · Ask a doctor or pharmacist before use if · When using this product · Stop use and ask a doctor if · If pregnant or breast-feeding · Keep out of reach of children.
3. **Took too much?** The overdose bullet (the "Overdose warning" card's text, else the bullet mentioning overdose in `keep_out_of_reach` or `warnings`) plus the Poison Control tap-to-call button. It always shows. When the label has no overdose bullet, it shows only the button.

A caption reads: "Every warning on the label, always open. They apply to everyone who uses this product; MedCheck doesn't rank them for you." Rows that predate sections show `warningsQuotes` as one "Warnings" card.

### Good to know

These are tiles for Alcohol, With food?, Drowsiness and driving and Allergies, using `quickAnswers()`'s bullets for those keys. When the label says nothing, the tile shows the fixed "The label doesn't mention … Ask a pharmacist." line in muted text. The Allergies tile shows the allergy alert bullet when there is one. It always ends with a button, "See inactive ingredients on the Original FDA label", that switches tabs.

### Source and status

Source ("FDA label via openFDA", or "Fictional demo label"), set ID, label date and the status chip's text. The `sourceLinks` appear as external links (opening in a new tab, with the sr-only "(opens in a new tab)").

## 6. Components (`src/components/medicine-card/`)

- `medicine-card.tsx`: header, tabs and footer. It accepts an optional `actions` slot, rendered under the status chip, which Feature 2 fills.
- `medicine-card-tabs.tsx` (`"use client"`): the shadcn/Base UI `Tabs` (`src/components/ui/tabs.tsx`), controlled so Good to know can switch to Original. It takes a `defaultTab` prop, which Feature 2's "Inspect labels" uses.
- New pieces, each server-safe unless noted: `ingredient-hero.tsx`, `uses-grid.tsx`, `label-directions.tsx` (the form switch is a small client child), `warning-cards.tsx`, `good-to-know.tsx`, `source-status.tsx`.
- `label-parts.tsx` keeps `LabelBullets`, `DosingTable` and `PoisonControlButton`, and gains `MarkedLine`.
- `quick-answers.tsx` is deleted. `quick-answers.ts` stays.

## 7. Accessibility

Tabs and the form switch are keyboard-operable (arrow keys, Base UI). Each section has a heading and `aria-labelledby`. Body text and warning text meet WCAG AA in both themes. Icons are `aria-hidden`. Marks aren't conveyed by color alone. Motion is limited to the existing `prefers-reduced-motion`-aware utilities.

## 8. Testing

- **Vitest, written first:** `medication-facts.test.ts` runs over every label in `src/lib/__fixtures__/quick-answers-labels.json` (Tylenol Extra Strength, Children's Tylenol, Advil, Zyrtec, ZzzQuil, Benadryl, Pepcid AC, Claritin), the family fixtures, a Calmora row and a row without `labelSections`. It asserts:
  - the traceability invariant (every line is its source bullet or a substring of it)
  - the Advil form blocks and age cards
  - the uses groups for Advil and Children's Tylenol
  - marks that cover only the pattern words
  - headed-warning grouping
  - the overdose card always present
  - nothing ever containing "safe"
- **e2e:** update the three photo pop-up assertions on the "Quick answers" heading (`e2e/medcheck.spec.ts`) to the Quick View tab and "Label directions". Add one assertion that switching to **Original FDA label** shows "Directions" as printed.
- Visual check at 375 px and 1280 px, light and dark (the `verify-frontend-change` skill).

## 9. Delivery

One PR into `dev`: `feat/medication-dashboard`. `AGENTS.md`'s code map gains `src/lib/medication-facts.ts` and the new card components. Its `quick-answers` entry is updated to say the module now feeds Good to know.
