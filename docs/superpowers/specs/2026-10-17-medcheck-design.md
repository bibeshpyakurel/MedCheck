# MedCheck — Hackathon MVP Design

Date: 2026-10-17 · Status: approved, revised 2026-10-17 · Source idea: `MedCheck_Project_Summary.md` (team handoff doc)

> **2026-10-17 revision.** The demo is gone: no demo banner, household, kit, tools or "Try the demo"; the fictional Calmora products are no longer part of the product (`patients.is_demo` stays in the schema, unused). Sign-in has three doors: Google, email one-time code, guest. Each account has exactly one person. After sign-in the user lands on the capture page (scan, take photo, choose photo; describing or picking a medicine is gone). The app has two tabs, **Medicines** and **Medicine report**. Checks run as an engine: only real findings appear, as plain-English warnings; the checks list, "no finding" rows, Checks tab, "About the checks" page and pharmacist questions are gone, and the document-vs-bottle check is removed (user-facing wording says "package", never "bottle"). The footer is one line; Poison Control lives behind **Get help** in the header. Sections below describe the revised product.

MedCheck helps anyone managing medicines see when two medicines share an active ingredient, and when two of them disagree on strength or units. It shows each finding as a plain-English warning. **Evidence, not advice:** it never calculates a dose, never says a combination is safe, and never resolves a conflict.

## 1. Scope

Audience: anyone managing medicines. Each account tracks one person, the account holder (relationship `self`); the report reads in the first person.

In: acetaminophen only; ingredient overlap and strength/unit clarity; the check engine (§6); one person's medicines with change history; a report with PDF download, share and email.

Out (later phases): other ingredients, weekly openFDA pipeline, RxNorm (dropped: fixed synonym table instead), dose log, Beers flags, installable PWA / offline, open-ended chat, more than one person per account, any dose calculation or age/weight row highlighting.

## 2. Delivery and git workflow

Repo: `github.com/bibeshpyakurel/MedCheck` (public). Branching, CI and deploys follow `AGENTS.md` § Git: `dev` is the working and production branch; `main` mirrors what is live.

## 3. Stack

| Concern | Choice |
| --- | --- |
| App | Next.js (App Router, TypeScript), Tailwind, shadcn/ui. One responsive web app, phone-first, laptop first-class, light + dark |
| Hosting | Vercel project `medcheck` (Hobby), production from `dev` |
| Data | Supabase project `medcheck` (`us-east-1`): Postgres, Auth (Google OAuth, email one-time code, anonymous), private Storage bucket `label-photos` |
| AI | Gemini (Flash tier) via AI SDK `@ai-sdk/google`, user's own Google AI Studio key, structured output validated with zod. Model id set by env `GEMINI_MODEL` |
| Barcode | `@zxing/browser` (works in iOS Safari, which lacks `BarcodeDetector`) |
| PDF | `@react-pdf/renderer`, generated server-side in a route handler |
| Email | Resend, enabled only when `RESEND_API_KEY` + `EMAIL_FROM` are set (needs a verified domain for arbitrary recipients; sandbox can send to the account owner) |
| Tests | Vitest (checks, NDC, normalization), Playwright e2e (Gemini mocked), GitHub Actions on every PR: lint, typecheck, test, build |

Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (server only: seeding), `GOOGLE_GENERATIVE_AI_API_KEY`, `GEMINI_MODEL`, `RESEND_API_KEY` (optional), `EMAIL_FROM` (optional). Google OAuth and the SMTP sender for email codes are configured in the Supabase dashboard (see `AGENTS.md`).

## 4. Data model (Supabase)

All patient data is owned by an auth user (Google, email code, or anonymous guest) and protected by RLS: a user reads and writes only rows under their own patient. The catalog is public read, server-write.

- `caregivers` — the account holder: `id` (= `auth.uid()`), `display_name`, `created_at`.
- `patients` — `id`, `caregiver_id`, `display_name`, `relationship`, `notes`, `is_demo` (unused), timestamps. Exactly one row per account, relationship `self`, created by `ensureSelfPatient()`; guests get display name "Guest".
- `formulations` (catalog) — `id`, `slug`, `brand_name`, `generic_name`, `dosage_form` (`liquid` | `tablet` | `caplet` | `capsule` | …), `is_fictional`, `ndc_packages text[]` (normalized 11-digit, no hyphens), `active_ingredients jsonb` (`[{name, normalized, strength_value, strength_unit, per_value, per_unit}]`), `directions_text`, `max_24h_text`, `warnings_quotes text[]` (verbatim, e.g. "do not use with other drugs containing acetaminophen"), `dosage_table_html` (sanitized), `source` (`openfda` | `fictional`), `openfda_set_id`, `label_effective_date`, `reviewed_at`.
- `source_documents` — `id`, `patient_id`, `kind` (`otc_package` | `drug_facts_photo` | `prescription_label` | `discharge_list` | `description`), `photo_path`, `transcript_text`, `document_date`, `facility`, `prescriber`, `pharmacy`, `created_at`.
- `medication_entries` — `id`, `patient_id`, `source_document_id`, `formulation_id` (nullable), `input_method` (new entries: `barcode` | `photo`; `voice` | `typed` | `picker` remain for old rows), `status` (`draft` | `confirmed`), `fields jsonb` (see §5), `created_at`, `confirmed_at`.
- `history` — append-only change log written by triggers on `patients`, `medication_entries`, `source_documents`: `entity`, `entity_id`, `action`, `before`, `after`, `actor`, `at`.
- `exports` — `id`, `patient_id`, `findings_snapshot jsonb`, `created_at`.
- `email_sends` — `id`, `caregiver_id`, `export_id`, `to_address`, `sent_at` (rate limit: 5 per account per day).

## 5. Shared contract

`src/lib/domain/schema.ts` is the single contract all features build against (zod + types): `EntryFields` (each field an AI suggestion plus `state` `pending` | `confirmed` | `edited` | `unknown` and its evidence), `MedicationEntry`, `CheckRun`, `Finding`. A finding's `title` + `detail` form the warning; `pharmacistQuestion` and the `document_vs_bottle` check id stay in the contract, unused.

## 6. The check engine (pure functions, `src/lib/checks/`, test-first)

Input: all confirmed entries for the person plus catalog formulations. Output: `CheckRun[]`. A check whose required field is `pending` or `unknown` on any relevant entry returns `unresolved` with the reason.

The engine runs behind the scenes. Only `finding` results reach the UI and the report, each as a plain-English warning naming the products, the label text, and the label's own warning quote when present.

1. **Ingredient overlap** — two distinct products share a normalized active ingredient (synonyms: acetaminophen, paracetamol, APAP, "acetaminophen (as …)"). Normalization is a fixed, reviewed synonym table in `src/lib/domain/ingredients.ts` (`normalizeIngredient()`); **no RxNorm lookup** — the supported ingredient set is small, and a hard-coded table is deterministic, testable and works offline. Never claims the dose doubled.
2. **Repeated record** — same product identity (formulation id, or name + strength + form) entered twice → reported as a repeat, *not* an overlap.
3. **Concentration** — two liquids with the same ingredient and different mg-per-mL → "same volume holds different amounts", both stated as on the label (100 mg per 5 mL vs 200 mg per 5 mL). Never suggests a volume.
4. **Units** — instructions and strength use units that don't line up (mL vs tsp/teaspoon, mg instruction for a liquid, missing unit) → finding.
5. **Database vs package** — for barcode entries, the openFDA label values differ from the values confirmed on the Drug Facts photo → finding. (Check id `database_vs_box`.)

## 7. Screens and flows

- **Landing** (`/`) — what MedCheck does, "Evidence, not advice", and three sign-in doors. Fits one phone screen with no scroll.
  - **Continue with Google** — Supabase OAuth; returns via `/auth/callback`.
  - **Continue with email** — email plus optional first and last name → Supabase emails a one-time code → the user enters it on `/sign-in/verify` → signed in.
  - **Continue as a guest** — Supabase anonymous sign-in; display name "Guest".
- **After any sign-in** the user lands on the capture page `/patients/{id}/add`.
- **Capture** — three ways:
  1. **Scan a barcode** → NDC lookup (catalog, then live openFDA) → shows database label → asks for a Drug Facts photo → review.
  2. **Take a photo** of a label, prescription or discharge list → Gemini extraction with per-field bounding boxes → review.
  3. **Choose a photo** from the device → same as Take a photo.
- **Review** — one row per field: label crop | AI value | **Matches** / **Edit** / **Can't tell** (→ unknown). If no box: show the whole photo. Nothing is saved as confirmed without a user action.
- **Medicines tab** — the person's medicine history: items waiting for review, warnings (findings only), the medicine list (with source, date, prescriber/facility/pharmacy), and activity (change history).
- **Label view** — confirmed concentration and units beside the label's own directions, 24-hour maximum and full children's table (never a highlighted row).
- **Medicine report tab** — **Preview report**, **Download PDF**, **Share** (Web Share API with the PDF on phones; fallback: download + `mailto:` with prefilled subject/body), **Send by email** (To, prefilled subject/body, PDF attached) when Resend is configured. Empty state: "You haven't added any medicines yet". Items still waiting for review are mentioned in one plain sentence. The report lists medicines and warnings only.
- **Header** — **Get help** on every page opens the fixed "I already gave both" message: contact a pharmacist or Poison Control at 1-800-222-1222, tap-to-call, nothing else.
- **Footer** — one small line: "Evidence, not advice…".
- **Leaving as a guest** — the menu's leave action confirms "If you leave, your medicines and report can't be retrieved later", then deletes the guest's data and signs out. Closing or reloading the tab during a guest session triggers the browser's leave prompt.

## 8. Product data

- `scripts/seed-catalog.ts`: one-time pull of acetaminophen oral OTC labels from `api.fda.gov/drug/label.json`; drops homeopathic and non-oral; groups store brands by ingredient + strength + form; hand-checked list of ~6–10 formulations including the NyQuil Cold & Flu formulations and a children's 160 mg/5 mL liquid.
- NDC lookup: decode UPC-A (`3` + 10-digit NDC + check digit) or GS1 GTIN; expand the 10-digit code to 4-4-2, 5-3-2, 5-4-1 hyphenated and 11-digit forms; query catalog, then openFDA `openfda.package_ndc`.

## 9. Milestones

- **M0 Foundation**, **M1 Feature flow**, **M2 Hardening** — historical; delivered the original flow, including the demo since removed.
- **2026-10-17 revision** — the changes summarized at the top of this spec.

## 10. Error handling

- Camera denied or unavailable → fall back to file upload (`<input type="file" accept="image/*" capture="environment">`).
- Barcode not found → "Not in our supported list" → photo flow.
- Gemini failure or timeout → keep the photo, let the user enter fields manually; every field starts unknown.
- openFDA unavailable → catalog only.
- Email over limit or not configured → Share / download fallback with a clear message.
- Unconfirmed or unknown fields never produce a passing check.
