# MedCheck — Hackathon MVP Design

Date: 2026-10-17 · Status: awaiting approval · Source idea: `MedCheck_Project_Summary.md` (team handoff doc)

MedCheck helps caregivers see when two medicines share an active ingredient, and when a prescription, discharge list and bottle disagree on strength or units. It turns each finding into a question for a pharmacist. **Evidence, not advice:** it never calculates a dose, never says a combination is safe, and never resolves a conflict.

## 1. Scope

In: acetaminophen only; the two core features (ingredient overlap; strength and unit clarity); the 8-step demo from the summary; all six checks; per-patient records with change history; PDF export with download, share and email.

Out (later phases): other ingredients, weekly openFDA pipeline, dose log, Beers flags, installable PWA / offline, open-ended chat, any dose calculation or age/weight row highlighting.

## 2. Delivery and git workflow

- Repo: `github.com/bibeshpyakurel/MedCheck` (public). `dev` = default/working branch. `main` = production, deployed by Vercel, PR-only (protected, admins included).
- Every feature: branch `feat/<name>` off `dev` → PR into `dev` → Claude merges after CI passes and review → Claude opens a `dev → main` PR → **the user merges to `main`**. Claude never merges to `main`.
- Milestones: **M0** foundation → **M1** full demo flow → **M2** hardening and polish. Submission is tonight (2026-10-17); live demo 2026-10-18 ~5 pm.

## 3. Stack

| Concern | Choice |
| --- | --- |
| App | Next.js (App Router, TypeScript), Tailwind, shadcn/ui. One responsive web app, phone-first, laptop first-class, light + dark |
| Hosting | Vercel project `medcheck` (Hobby). Production branch `main`; previews for `dev` and PR branches |
| Data | Supabase project `medcheck` (`us-east-1`): Postgres, anonymous Auth, private Storage bucket `label-photos` |
| AI | Gemini (Flash tier) via AI SDK `@ai-sdk/google`, user's own Google AI Studio key, structured output validated with zod. Model id set by env `GEMINI_MODEL` |
| Barcode | `@zxing/browser` (works in iOS Safari, which lacks `BarcodeDetector`) |
| PDF | `@react-pdf/renderer`, generated server-side in a route handler |
| Email | Resend, enabled only when `RESEND_API_KEY` + `EMAIL_FROM` are set (needs a verified domain for arbitrary recipients; sandbox can send to the account owner) |
| Tests | Vitest (checks, NDC, normalization), Playwright (demo flow, Gemini mocked), GitHub Actions on every PR: lint, typecheck, test, build |

Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (server only: seeding), `GOOGLE_GENERATIVE_AI_API_KEY`, `GEMINI_MODEL`, `RESEND_API_KEY` (optional), `EMAIL_FROM` (optional).

## 4. Data model (Supabase)

All patient data is owned by an auth user (anonymous by default) and protected by RLS: a caregiver reads and writes only rows under their own patients. The catalog is public read, server-write.

- `caregivers` — `id` (= `auth.uid()`), `display_name`, `created_at`.
- `patients` — `id`, `caregiver_id`, `display_name`, `relationship` (free text, e.g. "my son"), `notes`, `is_demo`, timestamps.
- `formulations` (catalog) — `id`, `slug`, `brand_name`, `generic_name`, `dosage_form` (`liquid` | `tablet` | `caplet` | `capsule` | …), `is_fictional`, `ndc_packages text[]` (normalized 11-digit, no hyphens), `active_ingredients jsonb` (`[{name, normalized, strength_value, strength_unit, per_value, per_unit}]`), `directions_text`, `max_24h_text`, `warnings_quotes text[]` (verbatim, e.g. "do not use with other drugs containing acetaminophen"), `dosage_table_html` (sanitized), `source` (`openfda` | `fictional`), `openfda_set_id`, `label_effective_date`, `reviewed_at`.
- `source_documents` — `id`, `patient_id`, `kind` (`otc_package` | `drug_facts_photo` | `prescription_label` | `discharge_list` | `description`), `photo_path`, `transcript_text`, `document_date`, `facility`, `prescriber`, `pharmacy`, `created_at`.
- `medication_entries` — `id`, `patient_id`, `source_document_id`, `formulation_id` (nullable), `input_method` (`barcode` | `photo` | `voice` | `typed` | `picker`), `status` (`draft` | `confirmed`), `fields jsonb` (see §5), `created_at`, `confirmed_at`.
- `history` — append-only change log written by triggers on `patients`, `medication_entries`, `source_documents`: `entity`, `entity_id`, `action`, `before`, `after`, `actor`, `at`.
- `exports` — `id`, `patient_id`, `findings_snapshot jsonb`, `created_at`.
- `email_sends` — `id`, `caregiver_id`, `export_id`, `to_address`, `sent_at` (rate limit: 5 per caregiver per day).

Anonymous sign-in is enabled. M2 adds "Save my records with email": link an email identity to the anonymous user (magic link), keeping all data.

## 5. Shared contract (written in M0, before parallel work)

`src/lib/domain/types.ts` is the single contract all features build against:

- `FieldKey`: `product_name`, `active_ingredient`, `strength` (amount + unit), `concentration` (mg per N mL), `instructions`, `max_24h`, `document_date`.
- `FieldValue`: `{ key, aiValue, confirmedValue, state: 'confirmed' | 'edited' | 'unknown', evidence: { kind: 'crop', bbox, sourceDocumentId } | { kind: 'quote', text } | { kind: 'database', formulationId } }`.
- `MedicationEntry`: id, patient, source document (kind, date), input method, formulation id, `fields: FieldValue[]`.
- `CheckRun`: `{ check: CheckId, status: 'finding' | 'no_finding' | 'unresolved', reason, findings: Finding[] }`. Wording rule: `no_finding` displays as "No overlap found in confirmed fields", never "safe".
- `Finding`: `{ id, check, title, entries: id[], evidence: Evidence[], labelWarningQuote?, pharmacistQuestion }`.

## 6. The six checks (pure functions, `src/lib/checks/`, test-first)

Input: all confirmed entries for a patient plus catalog formulations. Output: `CheckRun[]`. A check whose required field is `unknown` on any relevant entry returns `unresolved` with the reason (e.g. "strength unreadable on Prescription label").

1. **Ingredient overlap** — two distinct products share a normalized active ingredient (synonyms: acetaminophen, paracetamol, APAP, "acetaminophen (as …)"). Names both products, the ingredient, label text, and quotes the label's own warning when present. Never claims the dose doubled.
2. **Repeated record** — same product identity (formulation id, or name + strength + form) entered twice → reported as a repeat, *not* an overlap.
3. **Concentration** — two liquids with the same ingredient and different mg-per-mL → "same volume holds different amounts", both stated as on the label (100 mg per 5 mL vs 200 mg per 5 mL). Never suggests a volume.
4. **Units** — instructions and strength use units that don't line up (mL vs tsp/teaspoon, mg instruction for a liquid, missing unit) → finding.
5. **Document vs bottle** — the same medicine across documents (discharge list, prescription label, bottle) disagrees on strength or instructions → conflict listed with dates, left unresolved.
6. **Database vs box** — for barcode entries, the openFDA label values differ from the values confirmed on the Drug Facts photo → finding.

Each finding carries a fixed-template pharmacist question, e.g. *"The discharge list says 160 mg per 5 mL but the bottle says 100 mg per 5 mL. Which strength should I be using, and how much?"*

## 7. Screens and flows

- **Landing** — what MedCheck does, "Evidence, not advice", **Try the demo household** (anonymous sign-in + seeded records) or **Start my own**.
- **First use** — caregiver name (used on the PDF and in the email).
- **Patients** — list and add profiles.
- **Patient record** — medicines (with source, date, prescriber/facility/pharmacy), **Checks run** panel ("6 checks run, 1 couldn't be completed: strength unreadable"), findings with evidence, history tab, search. Persistent **"I already gave both"** button.
- **Add a medicine** — four ways:
  1. **Scan barcode** → NDC lookup (catalog, then live openFDA) → shows database label → asks for a Drug Facts photo → review.
  2. **Photo** of label, prescription or discharge list → Gemini extraction with per-field bounding boxes → review.
  3. **Describe it** (mic or typed) → Gemini extracts fields from the words → review shows the user's words as evidence; marked "from your description, not a label"; database-vs-box stays unresolved.
  4. **Pick** from the supported list.
- **Review** — one row per field: label crop | AI value | **Matches** / **Edit** / **Can't tell** (→ unknown). If no box: show the whole photo. Nothing is saved as confirmed without a user action.
- **Label view** — confirmed concentration and units beside the label's own directions, 24-hour maximum and full children's table (never a highlighted row).
- **Export** — preview, **Download PDF**, **Share** (Web Share API with the PDF on phones; fallback: download + `mailto:` with prefilled subject/body), **Email** form (To, prefilled subject/body with caregiver and patient name, PDF attached) when Resend is configured.
- **"I already gave both"** (button, or detected in a description) → fixed message: contact a pharmacist or Poison Control at 1-800-222-1222, tap-to-call, nothing else.

## 8. Product data

- `scripts/seed-catalog.ts`: one-time pull of acetaminophen oral OTC labels from `api.fda.gov/drug/label.json`; drops homeopathic and non-oral; groups store brands by ingredient + strength + form; hand-checked list of ~6–10 formulations including the NyQuil Cold & Flu formulations and a children's 160 mg/5 mL liquid.
- Fictional products (Bottle A 100 mg/5 mL, Bottle B 200 mg/5 mL, etc.) seeded with fake NDCs in a reserved range, marked fictional.
- NDC lookup: decode UPC-A (`3` + 10-digit NDC + check digit) or GS1 GTIN; expand the 10-digit code to 4-4-2, 5-3-2, 5-4-1 hyphenated and 11-digit forms; query catalog, then openFDA `openfda.package_ndc`.

## 9. Demo materials (`demo-assets/`)

Printable fictional materials, each with a seeded expected-values JSON for extraction-accuracy scoring (`scripts/score-extraction.ts`): Bottle A and Bottle B labels with barcodes, a prescription label, a discharge list that disagrees with a bottle on strength, and a fallback NyQuil barcode sheet. Demo household: caregiver "Alex Rivera", patient "Sam" (13), an acetaminophen product already on file. All synthetic; the UI shows a "Demo data — synthetic" badge on demo households.

## 10. Milestones

- **M0 Foundation** — scaffold, design tokens, Supabase project + migrations + RLS + anonymous auth, Vercel project + env, CI, shared contract (§5), this spec. Deployed to the `dev` preview, then a `dev → main` PR.
- **M1 Demo flow** (parallel feature PRs): (A) catalog seed + NDC lookup + scanner; (B) capture + Gemini extraction (photo, voice/typed) + review screen; (C) six checks + pharmacist questions + checks panel; (D) caregiver onboarding, patients, record page, history, demo household + reset, "already gave both"; (E) PDF export, share, email; (F) demo assets + scoring script.
- **M2 Hardening** — Playwright demo-flow test, save-with-email, manual crop (stretch), accessibility pass (contrast, tap targets, screen reader), README with setup and demo script, summary doc update.

## 11. Error handling

- Camera denied or unavailable → fall back to file upload (`<input type="file" accept="image/*" capture="environment">`).
- Barcode not found → "Not in our supported list" → photo flow.
- Gemini failure or timeout → keep the photo, let the user enter fields manually; every field starts unknown.
- openFDA unavailable → catalog only.
- Email over limit or not configured → Share / download fallback with a clear message.
- Unconfirmed or unknown fields never produce a passing check.
