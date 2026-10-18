# MedCheck — Compare with my medicines

From any medicine card, the user can line that medicine up against medicines already saved for the same person. They pick, check the confirmed values, and see side-by-side cards, the **Together** Venn and the label-backed findings, each with a pharmacist question they can copy.

Mockup (approved 2026-10-18): https://claude.ai/artifact/QKg4aPdmyeDoogDcWbCdww, screens 3 (pick and review) and 4 (results).

Builds on `2026-10-18-medication-dashboard-design.md` (the card's header `actions` slot and its `defaultTab` prop). It extends `2026-10-17-photo-answers-design.md` §4, which compares only the medicines in one photo. The photo pop-up's card now also offers this button.

## 1. Scope and boundaries

- **No new comparison engine.** Results come from `runChecks()` (`src/lib/checks/`) over the picked entries, and **Together** from `IngredientComparison`. The request's `normalizeIngredient` / `compareIngredients` / `compareStrengths` / `compareConcentrations` / `generateComparisonFindings` already exist as `normalizeIngredient()`, `checks/overlap.ts`, `checks/family.ts`, `checks/repeated.ts`, `checks/concentration.ts`, `checks/units.ts` and `compareProducts()`. A second engine could disagree with the Medicines page.
- **No schema change, no new check.** Different per-unit strengths of solid forms (a 200 mg tablet vs. a 400 mg tablet) are shown side by side in the cards, never as a finding and never summed.
- **No export change.** Comparisons among saved medicines already appear in the Medicines warnings and the PDF report. Saving an unsaved photo medicine puts its findings there too.
- **Boundaries as everywhere:**
  - never "safe", "no risk" or green
  - `no_finding` reads "None found in confirmed fields"
  - no replacement volume, no dose, no advice on which product to use
  - nothing claims the user took both
  - pharmacist questions are the existing fixed templates in `checks/questions.ts`

## 2. Entry point

**Compare with my medicines** (primary button, full width on phones) sits in the medicine card's header `actions` slot whenever the card knows the person (`patientId`):

| Where the card opens | Subject ("This medicine") |
|---|---|
| Entry page → card | that saved entry |
| Photo pop-up answer card (not saved yet) | an in-memory confirmed entry built with `fieldsFromFormulation()` from the matched label. The one-tap match is its confirmation, per the existing rule. **Compare never saves it** |

It is hidden when the person has no other medicine on file. If their other medicines are all waiting for review, it still shows, and the picker explains why they can't be picked yet.

## 3. The flow (one sheet)

A `Dialog`: a bottom sheet on phones, centered from `sm:`. It uses `useBackToClose()`, so device Back closes it. Two steps, and each step is a history entry, so Back from results returns to picking. An overlay stays open while Back lands on its own entry or one stacked above it (`overlayStaysOpen()`), so Back from a label opened over the results returns to the results.

### Step 1 — pick and review

- **This medicine** is shown as an accent card (name, ingredient + strength, form; plus "Fictional demo label, not a real product" for Calmora).
- **Compare with (pick one or more):** checkboxes over the person's entries (`listEntries(patientId)`), excluding the subject itself. Each row shows the name, ingredient + strength, form, and a state chip. Rows:
  - `confirmed`, all fields usable: "Confirmed"
  - `confirmed` with a `pending`/`unknown` field: pickable, chip "Needs confirmation" (violet `unresolved`)
  - `draft` (waiting for review): disabled, "Waiting for review", with a link to its review page
- **Check before comparing:** for each picked medicine, a read-only summary (ingredient, strength, unit, dosage form) with each value's state. A value that isn't confirmed shows "… needs confirmation" plus **Review it →** (the entry's existing review page, opened with `release()` + `replace`). There's no editing inside the compare flow.
- The **Compare N medicines** button is disabled until at least one medicine is picked.

### Step 2 — results

A server action, `compareMedicinesAction({ patientId, subject, entryIds })`, runs as the user and **saves nothing**. `subject` is `{ entryId }` or `{ formulationId }`. It loads the entries (`records.ts`) and formulations (`getFormulationsByIds`) and returns `runChecks({ entries: [subject, ...picked], formulations })` plus the products for **Together**.

Layout, top to bottom:

1. **Side-by-side cards.** Two medicines get a 2-column grid. Three or more get a horizontally scrolling row of cards on phones and a grid from `md:`. Each card shows: letter (A, B, C…), name, active ingredients, strength as printed (amount large, `per …` small), dosage form, source ("FDA label" + date / "Photo of a prescription label" / "Fictional demo label"), confirmation chip. Strengths are never added up.
2. **Together.** `IngredientComparison` over the picked products, diagram only (`diagramOnly`: the Venn, or the grid for three or more). The shared and family notes are the finding cards below, so nothing is said twice. An entry without a catalog formulation is adapted from its confirmed fields (name, ingredients via `normalizeIngredient()`, no label sections). Its family notes then appear only when another product's label supplies the quote, which is the existing rule.
3. **What the labels show.** One card per finding, from the `finding` runs, drawn with the Medicines page's `WarningCard` (same title, detail, label quote and evidence; `showVisual={false}`, since Together already draws the diagram), with a neutral label above the title. Titles are neutral:

   | Check | Title |
   |---|---|
   | `ingredient_overlap` | Shared ingredient identified |
   | `ingredient_family` | Same family of medicine |
   | `repeated_record` | Same medicine listed twice |
   | `concentration` | Different concentrations |
   | `units` | Different units or measurement basis |
   | `database_vs_box` | Listing and package differ |

   Each card shows:
   - the finding's `detail`
   - the label's own quote ("The label says …") when `labelWarningQuote` is set
   - **evidence**: which records were compared (`FindingEvidence.entryLabel`), each value as stated, the source document kind and date, the confirmation state
   - the **pharmacist question**, with **Copy question** (`navigator.clipboard.writeText`; the button reads "Copied" for 2 s; on failure the question text is selected so it can be copied by hand)
   - **Inspect labels**, which opens each product's medicine card sheet on the **Original FDA label** tab (`defaultTab`). An entry without a catalog label links to its entry page instead.

   **Different concentrations** adds proportional bars: one bar per bottle on a shared scale, each labeled with its strength **as printed** ("100 mg per 5 mL"). The bars are scaled by the check's internal mg per mL, which, as today, is never displayed. A fixed sentence follows: "These bottles contain different amounts of the active ingredient in the same liquid volume." The bars have a text equivalent (`role="img"` + `aria-label` listing each printed strength). There is no replacement volume, ever.
4. **Unable to complete comparison.** One violet (`unresolved`) card per `unresolved` run, listing its `reasons` (e.g. "The strength of … needs confirmation"), with a link to fix it on the review page.
5. **Checks run.** One compact row per remaining check: `no_finding` → "None found in confirmed fields"; `not_applicable` → "Nothing to compare". The rows use the `CHECK_TITLES` names. Neutral text, never green.
6. A fixed line: "“None found” only means none in the confirmed fields. It doesn't mean safe."

Loading shows a skeleton of the cards. On error: "Couldn't compare these medicines. Try again.", with **Try again** and Back to picking.

## 4. Pure logic: `src/lib/compare-view.ts`

`comparisonView(runs: CheckRun[], entries: MedicationEntry[]): ComparisonView` is pure and built test-first. It orders the sections (findings in `CHECK_IDS` order, then unresolved, then checks run), maps check → neutral title, attaches A/B/C letters in pick order, dedupes findings by `id` (as `warningsView` does), and adapts non-catalog entries for **Together**. The components render its output only.

## 5. Components (`src/components/compare/`)

- `compare-button.tsx` (`"use client"`): the header button that opens the sheet.
- `compare-sheet.tsx` (`"use client"`): the dialog, both steps, and calls to the action.
- `medicine-pick-list.tsx`, `pick-review.tsx`, `compared-cards.tsx`, `finding-card.tsx`, `concentration-bars.tsx`, `copy-question.tsx`.
- Reuses `ingredient-comparison.tsx`, `MedicineCardSheet` (with `defaultTab`) and `use-back-to-close.ts`.
- The server action lives in `src/app/patients/[patientId]/compare-actions.ts`.

## 6. Testing

- **Vitest, written first:**
  - `compare-view.test.ts`: titles, ordering, letters, dedupe, unresolved reasons, the non-catalog adapter
  - no output string contains "safe"
  - Calmora Bottle A + B → shared ingredient and different concentrations
  - Advil + Advil → same medicine listed twice
  - Advil + a naproxen label → same family
  - an entry with a `pending` strength → concentration unresolved
- **e2e:** from a saved Calmora Bottle A entry's card, pick the saved Bottle B → see "Shared ingredient identified" and "Different concentrations", copy a question, and Back returns to picking. The test cleans up its guest user.
- Visual check at 375 px and 1280 px, light and dark.

## 7. Delivery

A second PR into `dev` after the dashboard PR merges: `feat/compare-with-my-medicines`. `AGENTS.md`'s code map gains `src/lib/compare-view.ts` and the compare sheet.
