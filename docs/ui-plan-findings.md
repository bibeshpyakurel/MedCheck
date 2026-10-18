# UI plan — Phase 0 findings

What the code says, measured against the assumptions in `docs/ui-plan.md`. Where the two disagree, this file wins. Open decisions are marked **[decision]** and listed at the end.

## 1. Versions

| Package | Version | Note |
|---|---|---|
| next | 16.4.2 | App Router, `cacheComponents` off, middleware is `src/proxy.ts` |
| react / react-dom | 19.3.0 | Has built-in `<ViewTransition>` and `addTransitionType` |
| tailwindcss | 4 | `@tailwindcss/turbopack` loader |
| @base-ui/react | 1.9.0 | shadcn style `base-nova`: **Base UI, not Radix** (`render` prop, no `asChild`) |
| next-themes | 0.4.6 | `attribute="class"`, default `system` |

Candidate packages (latest on npm, 2026-10-17): `motion` 14.3.0 (peer react ^19), `@splinetool/react-spline` 4.1.0 + `@splinetool/runtime` 2.0.93, `unicornstudio-react` 2.4.0, `next-view-transitions` 0.3.5, `vaul` 1.1.2. None installed yet. Neither `motion` nor `framer-motion` is present.

## 2. Tokens and theming

- `src/app/globals.css`. Tokens are **oklch**, not the hex values in the plan's table (those were sampled from computed styles). `.dark` is a class set by next-themes; the custom variant is `&:where(.dark, .dark *)`.
- `--finding*`, `--unresolved*`, `--brand`, `--surface`, `--ink` already exist and are exposed via `@theme inline`.
- There is already a global `prefers-reduced-motion` rule that cuts every CSS animation and transition to 0.01 ms.
- `nums` utility = `tabular-nums`. `animate-fade-up` keyframe exists.

## 3. Components

- `src/components/ui/`: alert, alert-dialog, badge, button, card, dialog, dropdown-menu, input, label, select, separator, **sheet**, skeleton, sonner, table, tabs, textarea.
- **Fonts:** a display face is already loaded: **Inter Tight** as `--font-display` (`font-display` class) on titles and the logo. Bricolage Grotesque would replace it. **[decision]**

## 4. Home page (`src/app/patients/[patientId]/page.tsx`)

`AppShell` (sticky blurred header: ☰ `SiteMenu`, logo, `GetHelp`; one-line footer) → `RecordHeader` (whose record + the two tabs, a `nav aria-label="Record"`) → title + count + "Add a medicine" button → `NeedsReview` (drafts) → `Warnings` → `WarningCard` per finding → `MedicationList` (client; search + rows grouped by source document) → `Disclosure` "Activity" → `HistoryList`.

Tabs come from `src/components/records/record-header.tsx`, used on the home page, the export page and the entry pages. The add flow uses `AddFlowBar` instead.

## 5. Data shapes (`src/lib/domain/schema.ts`, not to be changed in a feature PR)

- **Finding:** `{ id, check, title, detail, entryIds, evidence: FindingEvidence[], labelWarningQuote, pharmacistQuestion }`. `check` is one of `ingredient_overlap | repeated_record | concentration | units | document_vs_bottle | database_vs_box`.
- **FindingEvidence:** `{ entryId, entryLabel (product name), field, text, evidence, documentKind, documentDate }`. For `ingredient_overlap`, `text` is `"Acetaminophen 325 mg per caplet"` (display name + `formatStrength`).
- **No structured `ingredient` / `products[]` on a finding.** The Venn (WP4) has to derive them in the UI: product name = `evidence[i].entryLabel`, strength = `formatStrength(entry.fields.ingredients[k].strength.value)` read from the entry the finding points at, ingredient = `displayIngredientName` of that ingredient. Nothing is computed; it is the same text already shown.
- **Entry fields:** `fields.productName.value`, `fields.ingredients[i].name.value`, `fields.ingredients[i].strength.value` (`{ amount, unit, perAmount, perUnit }`, shown with `formatStrength`). Each field has `state` (`pending | confirmed | edited | unknown`) and `evidence`.
- **Overlap normalization:** `normalizeIngredient()` in `src/lib/domain/ingredients.ts` (AGENTS.md: all ingredient comparisons go through it). WP3 uses it; the plan's own regex in §6.5 is dropped.

## 6. Add flow

- `/add` → `/add/photo` (`PhotoForm` → `PhotoCapture`): a **native `<input type="file" accept="image/*" capture="environment">`**, plus "Choose a photo". The client downscales to JPEG ≤ 2000 px and posts it to a Server Action.
- **Real loading states:** `preparing` (downscale), `reading` (one Server Action: upload + Gemini read), `leaving` (`router.replace(next)`: the `/match` page renders on the server and runs the catalog match). So "Reading the label…" maps to `reading`, and "Finding it in the FDA list…" maps to `leaving` for package photos. "Found <Product>" and the ingredient chips aren't known on the photo screen; they belong to the **match page**, so WP7 step 5 moves there.
- Package photo → `/entries/[id]/match` (`MatchPicker`): **one tap confirms the FDA label. There is no per-field review, by product rule** (AGENTS.md). Prescription and discharge photos → `/entries/[id]/review` (`ReviewForm`, `FieldRow`): per-field Confirm / Edit / Unknown, and "Confirm medicine" is already disabled until `isFullyReviewed()`.
- **WP8 applies to the review form only**. For package photos it shrinks to a press/check micro-interaction on the match confirm.
- **Bounding boxes:** yes. `Evidence.kind === "crop"` carries a normalized `bbox`, and `src/components/review/evidence-crop.tsx` already renders crops. Package-photo values come from the catalog (`kind: "database"`), so the label warning sentence has no box on the photo. WP14 uses boxes only where they exist.

## 7. `/` and the landing

The plan's assumption is wrong: `/` does **not** redirect into a guest. With no session it is a **landing page** with three sign-in doors (Google, email, guest). The spec says it must fit one phone screen with no scroll. A signed-in user (guests too) is redirected to their home: Medicines once anything is on file, otherwise `/add`. WP5 upgrades this page in place.

## 8. Motion

Not installed. `tw-animate-css` is installed.

## 9. Blank-on-scroll bug

Not reproduced yet. A fresh guest on production lands on `/add` (empty record, 812 px tall, no scroll). No `content-visibility`, `h-screen` or full-height `fixed` layer exists in app code. Candidates: the sticky header's `backdrop-blur-xl`, and the landing's `blur-3xl` 60rem glow (iOS Safari is known to drop paint under large blurred layers). This needs a record with several medicines, so a local dev server with `.env.local` (absent in this worktree) or a production session with medicines added. Done in WP1.

**WP1 result:** a seeded record (Tylenol, DayQuil Severe, Advil: one overlap), scrolled top to bottom at 375×812 in Chromium (mobile emulation) and WebKit, light and dark: every section paints, including Medicines, Activity and the footer. No code path matches the usual causes. The likely source is the capture tool: full-page screenshots of emulated viewports often leave everything below the first screen blank. One real defect did show: with the backdrop blur not rendered, page text read through the 70%-opaque sticky header. The header is now 85% (92% without blur support) and pads for `safe-area-inset-top` (needed for WP10). **Still to do:** a check on a real iPhone.

## 10. Other conflicts with the plan

- **Report (WP12):** the spec lists four actions: Preview, Download PDF, **Share** (Web Share API with the PDF on phones) and Send by email. The plan's three-button row drops Share. `src/components/report/report-preview.tsx` already renders the report as HTML (used by `/export/preview`), so a scaled paper preview needs no new rendering.
- **View transitions (WP9):** React 19.3's built-in `<ViewTransition>` works in the App Router with no configuration (`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`). `next-view-transitions` isn't needed.
- **PWA icons (WP10):** there is no `public/` folder. Icons can be generated from the `BrandMark` SVG with `next/og` `ImageResponse` (`app/icon.tsx`, `app/apple-icon.tsx`), with no new dependency. `statusBarStyle: "black-translucent"` puts white status-bar text over the light theme's near-white header. **[decision]**
- **Ingredient palette:** all 8 dark pairs pass AA (7.8–11.2:1). Slot 6 (`#B8E58C`) is **green**, and the product's rule is that nothing reads as a green "all clear". It gets swapped for a non-green hue. Light-theme pairs are still to be derived and checked.
- **Scenes:** no Spline or Unicorn assets exist (no `public/fx`, no project IDs). **[decision]**
- **Commits and branches:** the plan says `ui(WPx):`. The repo uses conventional commits and `feat/<name>` branches into `dev`, and `dev` **is production** (merging goes live). This worktree's branch is `bibeshpyakurel/ui-ux`. **[decision]**
- **e2e:** `e2e/medcheck.spec.ts` finds tabs by link name inside `main` (`openTab`). Moving the tabs to a bottom bar means updating those helpers in the same change.

## 11. Photo answers spec (merged to `dev` mid-build, PR #47)

`docs/superpowers/specs/2026-10-17-photo-answers-design.md` is now the newest spec, and it wins. It rewrites the capture flow: auto-read on photo, no kind radio, a confirm pop-up (bottom sheet), an answer card, and a two-medicine Venn / 3+ grid comparison. It also adds an `ingredient_family` check. Other sessions are building it now (`feat/photo-read`, `feat/photo-sheets`, `feat/quick-answers`, `feat/ingredient-compare`).

- **WP7 and WP8 are on hold** until `feat/photo-sheets` merges. They restyle the photo screen, the match step and the review, which that work replaces, so doing them now would only create conflicts. Afterwards, WP7's scan beam and status lines go onto the new "Reading the photo…" screen.
- **WP4's Venn** is for saved warnings on the Medicines page; the spec's comparison Venn is for one photo. They should share a visual language: `--overlap`, `--ring-a/b`, `IngredientChip` and `src/lib/overlap-visual.ts` are there to reuse.
- **`ingredient_family` findings** get the plain warning card (`overlapVisual` returns null for anything but `ingredient_overlap`).

## Decisions

The user said "just work on it" without answering one by one (2026-10-17), so each one below is the recommended default. Each can be reversed in its own commit.

1. **Scenes:** plumbing now (`src/lib/fx.ts`, `FxBudgetProvider`, `SceneSlot`); CSS/SVG stand-ins as the "posters". `@splinetool/*` and `unicornstudio-react` are installed only when real scenes and IDs exist.
2. **Bottom bar:** phones only (< 640 px); the top tabs stay at `sm` and up. The home page's "Add a medicine" button is hidden on phones, where the bar's Add replaces it.
3. **Display font:** Bricolage Grotesque (600/800) replaces Inter Tight as `--font-display`.
4. **Landing copy:** "Two medicines. / One ingredient." plus the plan's subtitle; the three doors stay; still one screen.
5. **Warning headline:** keeps the finding's full title (screen readers, e2e and the no-diagram reading all rely on it).
6. **Report:** paper preview, then Share as the main action on phones, then Preview / Download PDF / Send by email in one row.
7. **Status bar:** `appleWebApp.statusBarStyle: "default"`.
8. **Shipping:** branch `feat/ui-overlap`, conventional commits naming the WP (`feat(ui): WP4 …`), PRs into `dev`.
9. **Local env:** `.env.local` copied from the `enterprise-ui` worktree; local runs use the e2e fake Gemini.
10. **Scope:** stop after Tier 1.

## Deviations made while building

- **Palette:** slot 5 (lavender, too close to the violet "unresolved" color), slot 6 (green) and slot 7 (peach, read as amber next to the overlap chip) are replaced by orchid, aqua and steel blue. Every pair, light and dark, is ≥ 6.1:1.
- **`SceneSlot.poster`** is a `ReactNode`, not an image path, so the CSS/SVG stand-ins and later `<Image>` posters go through the same slot.
- **Landing copy (WP5):** "…straight from the label", not "the FDA label": prescription and discharge photos aren't FDA labels.
- **Landing mark (WP5):** animated in CSS, not Motion, so it runs before hydration and finishes overlapped without JS. The global reduced-motion rule now also zeroes `animation-delay`, so reduced motion shows end states at once.
- **Aurora (WP5/WP6):** gradients and one transform animation, with no blur filter (large blurred layers are a known iOS Safari paint problem while scrolling).
- **`?fx=1`** forces effects on a device the gate would skip (for demo testing); it never overrides reduced motion.
