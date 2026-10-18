# MedCheck — Photo answers: one photo, instant answers, automatic comparison

Date: 2026-10-17 · Status: approved · Extends `2026-10-17-otc-catalog-design.md` (where they disagree, this spec wins)

The core feature. The user takes one photo. If it shows one OTC medicine, a pop-up asks "Is this …?", and on confirm a card answers the questions people most often ask about it, from the FDA label already in our database: no typing, no live LLM. If the photo shows two or more medicines, the same pop-up confirms each one and the result is a comparison: which active ingredients they share, which belong to the same family, and each medicine's answers.

Gemini only reads the photo and suggests which products it shows. Every answer is the FDA label's own words, cut out by code.

## 1. Capture: one action, no questions first

- The capture page keeps **Take a photo** and **Choose a photo**. The photo is read **as soon as it is taken or chosen**. The "What is this a photo of?" choice (package / prescription / discharge list) is removed.
- Gemini decides what the photo shows: `otc_package`, `prescription_label` or `discharge_list`. The source document's `kind` is set from that.
  - `otc_package` → the confirm pop-up (§2).
  - `prescription_label`, `discharge_list` → today's per-field review, unchanged.
- For a package photo Gemini returns **every distinct product** it sees (front and back of one package count once).
- While reading: the photo, "Reading the photo…" and **Cancel**, on the same screen. No separate loading page, no notification.
- Nothing readable → today's "We couldn't read this label — retake the photo" with **Type it in**.

## 2. The confirm pop-up

A bottom sheet on phones, a centered dialog at laptop width, over the photo screen. Device Back closes it (`useBackToClose`).

- **One medicine:** "Is this **Tylenol Extra Strength**?" with ingredient + strength ("Acetaminophen 500 mg per caplet"), form and labeler. Below: **Not this one?** with up to 5 alternatives, then **None of these — type it in** (catalog search) and **Cancel** (discards the read, back to capture).
- **Alternatives are distinct products.** Catalog rows that are the same product (same brand name ignoring form words, same ingredient set, same strengths, same dosage form) collapse into one choice, keeping the best-ranked row. Different versions (Regular / Extra Strength / PM / 8HR / Children's) and other brands stay separate. Each choice names its labeler.
- **Several medicines:** one row per medicine, numbered "1 of 2", each with its own best match, **Not this one?**, **Type it in** and **Remove from this photo**. One **Continue** button confirms them all. With more than 3 medicines the rows step one at a time.
- Tapping **Continue** is the user's confirmation of which product each one is (the "AI only suggests" rule); the values then come from the FDA label.

## 3. The answer card (one medicine)

Opens in the same pop-up after **Continue**. **Nothing is saved yet.** The card ends with **Save to My medicines** (confirms the entry, then goes to My medicines) and **Don't save** (deletes the read and its drafts, back to capture). Leaving any other way keeps the draft "waiting for review", as today.

**Quick answers** come first, each a plain question over the label's own bullets:

| # | Question | Answer source (label's own words) |
|---|---|---|
| 1 | What is it for? | `uses` |
| 2 | What's in it? | active ingredients + strength, `purpose` |
| 3 | How much, and how often? — Adults | `directions` bullets for adults (by the label's own age phrases) |
| 4 | Children | `directions` bullets for children + the full dosing table, no row highlighted |
| 5 | Most in 24 hours | `max_24h_text`, else directions bullets about 24 hours |
| 6 | Taking other medicines? | `ask_doctor_or_pharmacist`, plus "do not use with other … containing" bullets |
| 7 | Alcohol | every bullet mentioning alcohol |
| 8 | Drowsiness and driving | every bullet mentioning drowsiness, sleepiness, driving or machinery |
| 9 | With food? | every bullet mentioning food, meals, milk, empty stomach or juice |
| 10 | Pregnant or breastfeeding | `pregnancy_or_breast_feeding` |
| 11 | Who shouldn't take it | `do_not_use`, `ask_doctor` |
| 12 | When to stop and call a doctor | `stop_use` |
| 13 | Allergies | `inactive_ingredients`, allergy alert bullets |
| 14 | Took too much? | the label's overdose bullet + Poison Control 1-800-222-1222 tap-to-call |

- Rows 1–6 and 14 always show; 7–13 sit behind **More answers**.
- When the label says nothing for 7, 8 or 9, the row shows a fixed line: "The label doesn't mention alcohol. Ask a pharmacist." Never "fine", never "safe", never green. Other empty rows are left out.
- "How long until it works" is not asked: no OTC label answers it.
- Adults/children split: bullets are grouped by the label's own phrases ("adults and children 12 years and over", "children 6 to under 12 years", "children under 2 years"). Every row is shown; none is highlighted; there is no age or weight input.
- Below the quick answers, **Everything on the label** keeps today's full card sections.
- The same card (with quick answers) opens from a saved medicine's page.

## 4. The comparison (two or more medicines)

After **Continue** with 2+ medicines, the pop-up shows **Together** first, then each medicine's answer card (stacked, collapsible). Save / Don't save cover the whole photo.

- **Two medicines: a Venn.** Left circle "Only in Advil", right "Only in Tylenol", middle "In both". Each ingredient with its strength per product.
- **Three or more: a grid.** One row per active ingredient, one column per medicine, a mark where it appears; shared rows first.
- **Shared ingredient:** "Advil and Motrin both contain ibuprofen" + the label's own "do not use with other drugs containing …" line when present. Status color `finding`.
- **Same family, different ingredient** (ibuprofen + naproxen): the two stay separate in the Venn, joined by a family note "Both are NSAIDs" with the label's own sentence naming the family ("… other drugs containing prescription or nonprescription NSAIDs [aspirin, ibuprofen, naproxen, or others]"). Shown only when a label's warning names the family. Families are a fixed, reviewed list in `src/lib/domain/families.ts`: NSAIDs, antihistamines, nasal decongestants, acid reducers, sleep aids.
- **Nothing shared:** "No shared active ingredient found in confirmed fields." Never "safe", never green.
- The comparison covers the medicines in this photo. Saved medicines keep their warnings on the Medicines page, where the new `ingredient_family` check also runs.

## 5. Boundaries

Unchanged: evidence, not advice; no dose calculation or inference; never "safe"; the children's table is shown whole and never highlighted; card text is the label's own words; "I already gave both" stays the fixed message under **Get help**.

## 6. Delivery

1. **Contract PR** — this spec; `ingredient_family` in `CHECK_IDS`.
2. **Quick answers** — `src/lib/quick-answers.ts` (pure, Vitest first) + the card's Quick answers block.
3. **Comparison** — `src/lib/domain/families.ts`, `src/lib/compare.ts` (pure), `src/lib/checks/family.ts`, `IngredientComparison` component.
4. **Photo read** — Gemini classifies the kind and returns every product; the upload action takes no kind; e2e Gemini scenarios for two products and a prescription.
5. **Photo sheets** — auto-read, confirm pop-up with distinct alternatives, answer card / comparison with Save / Don't save, e2e. Merges after 2–4.
