# MedCheck — US OTC catalog, photo match and medicine card

Date: 2026-10-17 · Status: approved · Extends `2026-10-17-medcheck-design.md` (where they disagree, this spec wins)

Every over-the-counter medicine sold in the US is in the catalog. A photo of an OTC package is matched to its FDA label in one tap, and a card shows everything that label says, readable on a phone.

## 1. Catalog data

- **Sources** (FDA, public domain), joined per label:
  - **NDC Directory** (`api.fda.gov/drug/ndc.json`, `product_type:"HUMAN OTC DRUG"`): structured strengths (`"200 mg/1"`, `"100 mg/5mL"`), dosage form, labeler, package NDCs. Joined to labels by `spl_id` or package NDC.
  - **Drug Label** (`api.fda.gov/drug/label.json`): the Drug Facts sections (uses, purpose, directions, do not use, ask a doctor, ask a doctor or pharmacist, when using, stop use, pregnancy or breast-feeding, warnings, keep out of reach, inactive ingredients, storage) and the dosing table.
  - The WHO publishes no US product data. DailyMed carries the same FDA labels and is the link we cite.
- **Scope now:** routes `ORAL`, `SUBLINGUAL`, `BUCCAL`. Other routes (topical, ophthalmic, nasal, …) are a later import run once size is measured. Homeopathic products and multi-product kits are excluded.
- **One row per FDA label** (`openfda_set_id`), slug `otc-<set_id>`, `source = 'openfda'`, `reviewed_at = null`. Hand-checked seed rows (`reviewed_at` set) win: an imported label whose NDCs are already on a reviewed row is skipped.
- **Strength** keeps its "per" (500 mg *per caplet*, 160 mg *per 5 mL*): the concentration check depends on it.
- **Card text** (`label_sections`): each section's own label text split into short bullets by code (headings, bullet glyphs and repeated words removed). Never reworded, never AI-written.
- **Sources** (`source_links`): the label's DailyMed page; MedlinePlus (NIH) per ingredient where a page exists. Links only; MedlinePlus text is licensed and not copied.
- **Ingredient names:** every salt/USP spelling the import produces maps to its base ingredient in `normalizeIngredient()`'s reviewed table (`naproxen sodium` → `naproxen`, `loratadine usp` → `loratadine`). No blanket salt-stripping: `docusate sodium`, `magnesium citrate`, `calcium carbonate` keep their names. No external normalization service.
- **Import:** `npm run import:otc` — idempotent upsert on `slug`; `--dry-run` prints counts, rejects by reason and estimated size, writes nothing. Re-run whenever fresh data is wanted; a schedule is later work.
- **Schema** (migration `20261018000517_otc_catalog.sql`): `labeler_name`, `label_sections jsonb`, `source_links jsonb`; trigram index on brand + generic name; RPC `search_formulations(query, max_results)`.

## 2. Photo flow for OTC packages (`kind = otc_package`)

1. **Take or choose a photo.** Gemini reads it as today.
2. **No product name and no active ingredient read** (or Gemini failed) → "We couldn't read this label — retake the photo", with **Type it in** below.
3. **Match.** A pure function ranks catalog candidates (from `search_formulations` on the brand Gemini read, then on its ingredient names) against what Gemini read: brand, ingredients, strengths, dosage form. A candidate is pre-selectable only when every strength Gemini read agrees with it. The confirm step shows **"Is this the medicine?"** with the best agreeing match selected, a dropdown of the next matches (up to 5) and **None of these — type it in**.
4. **Type it in** searches the catalog by name with the same picker; free text is the last resort and saves an entry whose strength is `unknown` (checks needing it are unresolved).
5. **One tap on Confirm** saves a confirmed entry: `fieldsFromFormulation()` values, state `confirmed`, evidence `database`, `formulation_id` set, `input_method` `photo`. No per-field review, no pharmacist wording in this flow. The card opens.
6. **Several medicines in one photo:** the first goes through this flow; the others are drafts handled as today.

Prescription labels and discharge lists keep today's per-field review: they are not in the catalog, so their values come only from Gemini's read.

## 3. Medicine card

A bottom sheet on phones, a centered dialog at laptop width; also reachable from the entry page.

- **Header:** brand, each active ingredient with strength ("Ibuprofen 200 mg per capsule"), labeler, label date; "Not hand-checked" note when `reviewed` is false.
- **Sections** (only those the label has), plain headings over bullets: What it's for · Active ingredients and purpose · How to take it (directions + the full dosing table, never a highlighted row) · 24-hour limit · Don't use if · Ask a doctor first if · Taking other medicines? · While using it · Stop and ask a doctor if · Pregnant or breastfeeding · Other warnings · Keep out of reach of children · Inactive ingredients (allergies) · Storage.
- **Footer:** Sources (DailyMed, MedlinePlus links); Poison Control 1-800-222-1222 tap-to-call.
- Phone-first, ≥ 44 px targets, light and dark.

## 4. Boundaries (unchanged in spirit)

- Gemini only suggests *which product* it is; the user's one tap confirms it, and the values then come from the FDA label. That tap is the confirmation the "AI only suggests" rule requires.
- No dose calculation, no "safe", the dosing table is never highlighted, and the checks run exactly as before on confirmed entries.

## 5. Delivery

1. **Contract PR** — this spec, schema + migration (applied), `AGENTS.md` wording.
2. **Import PR** — FDA join + section parser + synonyms + `import:otc`, Vitest first; dry run reviewed, then imported; verifier agents spot-check ~100 random rows against the live FDA labels.
3. **Photo-match + card PR** — matcher (pure, tested), confirm step, card, e2e for the fast path.
