# MedCheck UI/UX Implementation Plan — "The Overlap"

> **For the implementing session.** This is a complete, ordered build plan for the MedCheck UI/UX upgrade. Put it in the repo as `docs/ui-plan.md`, read it fully, do **Phase 0 discovery** first, then work through the work packages (WPs) in order. Each WP has the files to touch, the steps, and acceptance criteria. Do not start Tier 2 until every Tier 1 WP passes its acceptance criteria.
>
> Companion visual reference (concepts, idea catalog, demo script): the "MedCheck Visual Playbook" artifact.
>
> **Read `docs/ui-plan-findings.md` alongside this file.** Phase 0 found several places where the code differs from the assumptions below; the findings file records each one and how the plan adapts. Where they disagree, the findings file wins.

---

## 1. Product constraints (non-negotiable)

1. **Evidence, not advice.** The UI must never add up strengths, show a "total dose", show a "safe" or green-check celebration for a combination, or suggest what to take. Strengths from different products sit **side by side** and are never summed.
2. **Label text is sacred.** Quoted label warnings, directions and strengths render exactly as they do now. Effects never sit behind label text.
3. **Accessibility is part of scoring.** WCAG AA contrast (≥ 4.5:1 for body text) on every warning. Every visual (Venn, 3D scene) has a text equivalent. `prefers-reduced-motion` turns off all non-essential motion.
4. **Phones first.** Design and test at 375×812. Judges will use their own phones on venue Wi-Fi.
5. **Keep the existing flows and routes working.** This is a visual and interaction upgrade, not a rewrite.
6. **Keep "Get help"** (poison control `tel:18002221222`) and the "Evidence, not advice." footer visible.

---

## 2. What is already known about the codebase

Observed from production (`medcheck-six.vercel.app`). Verify each in Phase 0.

| Item | Observed |
|---|---|
| Framework | Next.js **App Router** (`self.__next_f` present), deployed on Vercel |
| Styling | **Tailwind CSS v4** (`@layer theme`), shadcn/ui-style CSS variables |
| Theming | `.dark` class on `<html>` (likely `next-themes`), Light / Dark / System toggle in the menu |
| Fonts | Inter via `next/font` (three font CSS variables on `<html>`) |
| Semantic tokens | `--finding` / `--finding-foreground` / `--finding-surface` (amber, used for warnings) and `--unresolved` / `--unresolved-foreground` / `--unresolved-surface` (violet). Dark: `--background:#090c11`, `--card:#11151b`, `--primary:#55d1ca`, `--brand:#2cbbb6`, `--finding:#f1b04f`, `--finding-surface:#35210d` |
| theme-color | `#f8fafc` (light) and `#0e1218` (dark) |
| PWA | **No web manifest** |
| Routes | `/` (redirects into a guest patient), `/patients/[patientId]` (My medicines), `/patients/[patientId]/add` (3-step add: Photo → … → …), `/patients/[patientId]/export` (Medicine report), `/patients/[patientId]/entries/[entryId]` (Details and label), `/how-it-works`, plus a "Why it matters" page |
| Data on an entry | Product name; form; per-ingredient strength (e.g. "Acetaminophen 325 mg per capsule"); status chips (Confirmed, Photo, Medicine package); openFDA label with effective date; quoted warnings; DailyMed link; the user's photo |
| Warning model | "X and Y both contain <Ingredient>", with each product's strength and the label's own warning quote. There is also an "unresolved" state (violet tokens) |
| Camera | "Take a photo — Opens your camera" is probably a native `<input type="file" accept="image/*" capture>` rather than a live `getUserMedia` stream. **Verify**: it decides how WP7 is built |
| Known bug | In a 375px emulated viewport, scrolling the home page rendered the lower half blank. Reproduce on a real phone; if it's real, check for `content-visibility`, `overflow` on a transformed ancestor, or a full-height `fixed` layer |

---

## 3. Phase 0 — Discovery (do first, ~30 min)

Write the answers to `docs/ui-plan-findings.md`:

1. Next.js, React and Tailwind versions (`package.json`). Note whether React is 19.
2. Where the global CSS tokens live (likely `app/globals.css`) and how `.dark` is applied.
3. Component library: is `components/ui/*` shadcn? Which primitives exist (Sheet, Dialog, Tabs, Card, Badge)?
4. The component tree for the home page: the warnings list, warning card, medicine card, activity list, and the top tabs ("Medicines" / "Medicine report").
5. The shape of a **warning** object and an **entry/ingredient** object (types or Prisma/DB schema). Write down the exact field names for product name, ingredient name, strength text, and label-quote text.
6. How the add flow is built: the step components, how the photo is captured (native input or `getUserMedia`), where OCR/lookup runs, and what loading states exist. **Does OCR return bounding boxes?** (This decides WP14.)
7. What `/` does with no session versus a guest session. Where would a landing/hero screen go?
8. Whether `motion` / `framer-motion` is already installed.
9. Reproduce the blank-on-scroll bug at 375px and on a real phone if possible.

If anything below conflicts with what you find, the code wins: adapt the plan and note the change in the findings file.

---

## 4. Design system additions — "The Overlap"

The logo is two overlapping circles. The whole visual language is built from that: **two things, one shared region, glowing amber.**

### 4.1 Color

Reuse the existing tokens. Add only these, in `globals.css`, for both `:root` and `.dark`:

```css
/* Overlap system */
--overlap: var(--finding);                 /* the shared-ingredient amber */
--overlap-glow: color-mix(in oklab, var(--finding) 55%, transparent);
--ring-a: var(--primary);                  /* product A circle */
--ring-b: color-mix(in oklab, var(--foreground) 55%, var(--primary)); /* product B circle */

/* Ingredient palette (8 slots, AA-safe text on --card in both themes).
   Amber is RESERVED for overlap and must not appear here. */
--ing-1: #8FE0D4;  --ing-1-bg: #12302C;
--ing-2: #A9B4FF;  --ing-2-bg: #1E2340;
--ing-3: #F5A3C7;  --ing-3-bg: #3A1D2B;
--ing-4: #9FD8FF;  --ing-4-bg: #13283A;
--ing-5: #C9B6FF;  --ing-5-bg: #261E3F;
--ing-6: #B8E58C;  --ing-6-bg: #1F2E14;
--ing-7: #FFB3A1;  --ing-7-bg: #3A1F18;
--ing-8: #D7DEE4;  --ing-8-bg: #20262C;
```

Pick darker text and lighter backgrounds for the `:root` (light) versions. Run a contrast check for all 8 pairs in both themes.

Expose them to Tailwind v4 through `@theme inline { --color-overlap: var(--overlap); ... }` so classes like `bg-overlap` work.

### 4.2 Typography

- Keep **Inter** for body and UI text (it's already loaded and readable).
- Add one display face **for headings only**: **Bricolage Grotesque** (weights 600/800) via `next/font/google`, exposed as `--font-display`. Use it for page titles ("My medicines"), the landing headline and warning headlines. If the team prefers fewer fonts, skip this step. It is the cheapest way to stop looking like a default dark template.
- Ingredient chips and strengths use tabular numbers: `font-variant-numeric: tabular-nums`.

### 4.3 Motion tokens — `lib/motion.ts`

```ts
export const ease = {
  out: [0.22, 1, 0.36, 1] as const,      // default UI ease
  inOut: [0.65, 0, 0.35, 1] as const,
};
export const dur = { xs: 0.12, sm: 0.2, md: 0.32, lg: 0.6, hero: 1.2 };
export const spring = {
  snappy: { type: "spring", stiffness: 520, damping: 38 },
  soft:   { type: "spring", stiffness: 260, damping: 30 },
  drop:   { type: "spring", stiffness: 380, damping: 22 }, // things landing
};
export const stagger = 0.04;
```

Rules: UI feedback ≤ 200 ms; screen transitions ~320 ms; only the hero moment may exceed 600 ms. Press state on every tappable card or button: `scale: 0.98` over `dur.xs`.

---

## 5. Dependencies

Install only these (ask the user before adding anything else):

| Package | Purpose |
|---|---|
| `motion` | Animations, layout transitions, gestures (skip if `framer-motion` already exists, and use that) |
| `@splinetool/react-spline` + `@splinetool/runtime` | Spline scenes. Check the README for the Next.js entry point (`@splinetool/react-spline/next`), which renders a placeholder on the server |
| `unicornstudio-react` | Unicorn Studio scenes. Import from `unicornstudio-react/next` in Next.js. It's a community package, so read its README for the props (`projectId`, `width`, `height`, `variables`, `preset`, `sceneRef`, lazy-load and fps/scale options) |
| `next-view-transitions` | Shared-element page transitions with the App Router (WP9). Optional: a hand-rolled `document.startViewTransition` wrapper also works |
| `vaul` | Draggable bottom sheet (Tier 3 menu only) |

Check React 19 / Next version compatibility for each before installing. Record exact versions in the findings file.

---

## 6. Phase 1 — Shared infrastructure (build before any WP)

### 6.1 FX kill switch and capability gate — `lib/fx.ts`

```ts
export const FX_ENABLED = process.env.NEXT_PUBLIC_FX !== "0";

export function canRunHeavyFx(): boolean {
  if (typeof window === "undefined") return false;
  if (!FX_ENABLED) return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return false;
  if ((nav.deviceMemory ?? 8) < 4) return false;
  if ((navigator.hardwareConcurrency ?? 8) < 4) return false;
  return true;
}
```

Also support `?fx=0` in the URL (stored in sessionStorage) so effects can be turned off live during the demo.

### 6.2 `<SceneSlot>` — `components/fx/scene-slot.tsx`

One wrapper used by **every** Spline and Unicorn scene. It must:

1. Render a **poster** `<Image>` (exported still of the scene) immediately, in a box with a fixed `aspect-ratio` so there is no layout shift.
2. Mount the live scene only when **all** of these are true: `canRunHeavyFx()`; the slot is within 200px of the viewport (IntersectionObserver); the browser is idle (`requestIdleCallback`, with a 1500 ms fallback); and the FX budget grants a slot (6.3).
3. Cross-fade from poster to live scene over 400 ms once the scene reports loaded.
4. **Pause** when offscreen or when `document.hidden` (Spline: `app.stop()` / `app.play()`; Unicorn: destroy and re-init, or its pause API if the package exposes one).
5. Wrap the scene in an error boundary that falls back to the poster silently.
6. Take an `ariaLabel` prop and render it as `role="img"`. The scene canvas itself is `aria-hidden`.

```tsx
type SceneSlotProps = {
  kind: "spline" | "unicorn";
  poster: string;            // /fx/posters/<name>.webp
  aspect: string;            // "9 / 10"
  ariaLabel: string;
  priority?: number;         // higher wins the FX budget
  children: (api: { onReady: () => void }) => React.ReactNode; // renders the live scene
};
```

Load the scene components with `next/dynamic(() => import(...), { ssr: false })`.

### 6.3 FX budget — `components/fx/fx-budget.tsx`

A React context that allows **one live WebGL scene at a time** (two on desktop). A slot requests a lease with a priority. When a higher-priority slot becomes visible, lower ones release and fall back to their poster. Mount the provider in the root layout.

### 6.4 Hooks

- `useReducedMotion()`: re-export from `motion`, or a `matchMedia` hook.
- `useWarnings()` / existing data hooks: just confirm where the home page gets its warning count, so scenes can read `warnings.length`.

### 6.5 Ingredient colors — `lib/ingredient-colors.ts`

```ts
const SLOTS = 8;
export function normalizeIngredient(name: string) {
  return name.toLowerCase()
    .replace(/\b(hydrochloride|hydrobromide|hcl|hbr|sodium|citrate|maleate)\b/g, "")
    .replace(/[^a-z]/g, "");
}
export function ingredientSlot(name: string): number {
  const s = normalizeIngredient(name);
  let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (h % SLOTS) + 1;                          // 1..8
}
/** Overlapping ingredients always render as --overlap (amber), whatever their slot. */
export function ingredientTone(name: string, overlapping: Set<string>) {
  return overlapping.has(normalizeIngredient(name)) ? "overlap" : `ing-${ingredientSlot(name)}`;
}
```

Use the same normalization the backend uses for overlap detection if one exists (check in Phase 0). Do not invent a second definition of "same ingredient". If the backend already provides the overlapping ingredient names, use those directly.

### 6.6 Asset folder

```
public/fx/
  posters/   landing-capsules.webp, aurora-teal.webp, aurora-amber.webp, shelf.webp ...
  scenes/    *.splinecode (self-hosted Spline exports, avoids CORS and gives caching)
```

**Acceptance (Phase 1):** `NEXT_PUBLIC_FX=0` builds and shows only posters. Reduced motion shows only posters. Lighthouse mobile performance on the home page doesn't drop by more than 5 points after Phase 1.

---

## 7. Tier 1 work packages (must ship)

### WP1 — Fix the blank-on-scroll bug
- Reproduce, find the cause, fix it. Usually it's a `position: fixed` full-height layer, `transform` on a scrolling ancestor, `content-visibility: auto` without `contain-intrinsic-size`, or `h-screen` combined with `overflow-hidden` on a wrapper.
- **Accept:** scrolling the full home page at 375×812 and on iOS Safari shows every section, including Medicines and Activity.

### WP2 — Bottom tab bar and header
**Files:** the layout that renders the top "Medicines / Medicine report" tabs; new `components/nav/bottom-bar.tsx`.
- Replace the top segmented tabs with a fixed bottom bar: **Medicines**, a raised center **Add** button (→ `/patients/[id]/add`), and **Report**.
- `position: fixed; bottom: 0`; `padding-bottom: env(safe-area-inset-bottom)`; `backdrop-filter: blur(16px)` over `color-mix(in oklab, var(--background) 72%, transparent)`; hairline top border `var(--border)`.
- Active tab: icon + label in `--primary`, plus a 2px indicator that slides between tabs with a Motion `layoutId`.
- Add bottom padding to `<main>` equal to the bar height plus the safe-area inset so content never hides behind it.
- Keep the top header with the logo, menu and "Get help". Make it sticky with the same blur.
- Hide the bar inside the add flow (it has its own Cancel and step header).
- **Accept:** tabs are reachable with a thumb; nothing is hidden behind the bar; keyboard focus order is logical; it works in light and dark.

### WP3 — Ingredient color system
**Files:** medicine card component, warning card, entry details page, `lib/ingredient-colors.ts`.
- Render every ingredient as a chip: `bg-[var(--ing-N-bg)] text-[var(--ing-N)]`, or `bg-finding-surface text-finding` with a 1px `--finding` ring when it is an overlapping ingredient.
- Chip text: `"<Ingredient> <strength value> <unit>"`, e.g. `Acetaminophen 325 mg`. Use the full strength string from data. Never compute anything.
- The same ingredient gets the same color on every screen.
- **Accept:** on the home page the shared ingredient (amber) is visible on both medicine cards without reading the warning; all chips pass AA contrast in both themes.

### WP4 — Venn warning card (highest-impact item)
**Files:** new `components/warnings/overlap-venn.tsx`; the existing warning card.

Component:

```tsx
type OverlapVennProps = {
  ingredient: string;                                    // "Acetaminophen"
  products: { id: string; name: string; strength: string }[]; // strength exactly as stored, e.g. "500 mg per capsule"
};
```

- **Two products:** an SVG with two circles (product A = `--ring-a`, product B = `--ring-b`, fill opacity ~0.14, 1.5px stroke) and the lens-shaped intersection filled `--overlap`. Each circle shows the short product name and its own strength. The intersection shows the ingredient name (or a short form if it doesn't fit; full name in the headline).
  - Compute the lens path from the two circle centers and radius (two arcs). Use `viewBox="0 0 320 150"` and scale to width.
- **Three or more products sharing one ingredient:** don't draw a 3-way Venn. Show a horizontal row of product "pills" joined by an amber connector line through a central amber ingredient badge.
- **Animation on mount** (skip with reduced motion): circles start 24px apart and slide together with `spring.soft`; the lens fades and scales from 0.6 → 1 with a soft amber `drop-shadow` glow that settles over 600 ms. It plays once per card, when it first scrolls into view.
- **Accessibility:** `role="img"` with `aria-label="<A> and <B> both contain <Ingredient>. <A>: <strengthA>. <B>: <strengthB>."` Keep the existing text headline. Move the long paragraph into the card body below the diagram (shorter, or behind "See the label evidence").

New warning card order:
1. Eyebrow "Shared ingredient" (amber, small caps)
2. `<OverlapVenn>`
3. Headline: "Both contain Acetaminophen" (display font)
4. The label's own warning quote (keep the existing amber quote block)
5. "See the label evidence" disclosure (existing)

Card treatment: border `--finding` at ~40% mix; background a subtle vertical gradient from `--finding-surface` (top) to `--card`. Remove the left accent rail if the gradient gives enough emphasis.

- **Accept:** a first-time viewer can say which two products overlap and on what ingredient within ~1 second; no sums anywhere; a screen reader reads the full sentence.

### WP5 — Landing hero (Spline + Unicorn)
**Where:** decide in Phase 0. Preferred: `/` renders a landing screen when there is no session, with "Get started" → the existing guest flow. If `/` must keep redirecting, show the hero as a one-time intro (sessionStorage flag) before the redirect, skippable by tapping.

Layout at 375px:
- Background: Unicorn **aurora** scene (full-bleed, behind everything, `scale 0.5`, `fps 30`, lazy).
- Top ~46%: Spline **capsules** scene in a `<SceneSlot aspect="1 / 1">`.
- Headline (display, ~34px/1.02, weight 800): "Two medicines." / "**One ingredient.**" (second line in `--overlap`).
- Sub (Inter 15px, muted): "Photograph your medicine labels. MedCheck shows what they share, straight from the FDA label."
- Primary button: "Add your first medicine" (or "Get started").
- Footer line: "Evidence, not advice."

Behavior:
- On load: the capsules sit apart. After ~600 ms, `app.setVariable("merge", 1)` and they slide together; the overlap glow brightens.
- On tap of the capsules: `emitEvent("mouseDown", "capsule_left")` plays a small wobble.
- Optional (Tier 3): gyroscope parallax.

Logo intro (optional, cheap): the two logo rings scale in and overlap over 900 ms, done in CSS/Motion. No WebGL needed.

- **Accept:** first paint shows the poster within LCP budget (< 2.5 s on throttled 4G); the live scene cross-fades in without layout shift; it works with FX off.

### WP6 — Warning-reactive ambient background (Unicorn)
**Files:** the home page layout.
- A Unicorn **aurora** scene in a `<SceneSlot>` confined to the **top ~240px** of the home page (behind the header and the "My medicines" title only), masked out with `mask-image: linear-gradient(to bottom, black 40%, transparent)`.
- `variables={{ alert: warnings.length > 0 ? 1 : 0 }}`. In the Unicorn scene, `alert` crossfades the palette from teal to amber over ~1.2 s.
- Never behind cards or label text.
- **Accept:** adding a medicine that creates a warning visibly warms the header area; removing it cools it; contrast of the title is unaffected.

### WP7 — Scan / photo step polish
Build **Option A** now. Option B is Tier 2.

**Option A (native capture, works everywhere):**
1. After the photo is chosen, show it full-width in a rounded frame.
2. Corner brackets (four SVG L-shapes in `--primary`) animate from the frame edges to ~10% inset (`spring.snappy`).
3. While lookup/OCR runs: a horizontal **scan beam** sweeps top ↔ bottom (CSS animation; a 2px line with a `--primary` glow). Optional: a Unicorn "scan" scene with `variables={{ progress }}` if it looks clearly better than CSS. CSS is the default.
4. Status copy cycles under the image: "Reading the label…" → "Finding it in the FDA list…" → "Found <Product>". Use the real loading states; don't fake timings.
5. When results return, the ingredients fly in as chips (WP3 colors), staggered 120 ms.

**Option B (Tier 2, live viewfinder):** a `getUserMedia({ video: { facingMode: "environment" } })` stream in a `<video>`, with the bracket overlay, a capture button and a fallback to the native input on permission denial. Only build this if Tier 1 is finished.

- **Accept:** the step never looks frozen; works with reduced motion (beam replaced by a progress bar); no fake delays added.

### WP8 — Confirm step (step 2/3) micro-interactions
- Each detected field (form, each strength) appears as a row that **types in** (or fades and slides up with stagger) with a "Confirm" tap target.
- Tapping confirm morphs the button into a check (SVG `pathLength` 0 → 1, 250 ms) and tints the row border `--primary`.
- The step indicator at the top fills its segment with a width animation when the step completes.
- The final "Save" button is disabled until every field is confirmed, matching the existing "nothing counts until you do" rule. Check the current logic and only restyle it.
- **Accept:** confirming feels deliberate and satisfying; no change to what gets saved.

### WP9 — Card → detail shared-element transition
- Use `next-view-transitions` (`<Link>` from the package plus its provider in the layout), or wrap `router.push` in `document.startViewTransition` with a fallback.
- Give the medicine card's title and container `view-transition-name: entry-<id>-title` / `entry-<id>-card`, and the matching elements on `/entries/[entryId]` the same names.
- CSS: `::view-transition-group(*) { animation-duration: 320ms; animation-timing-function: cubic-bezier(.22,1,.36,1); }`. Disable under reduced motion.
- Back navigation reverses it.
- **Accept:** tapping a medicine expands the card into the details page smoothly on Chrome Android and iOS Safari 18+; older browsers navigate normally.

### WP10 — PWA install
- `app/manifest.ts`: `name: "MedCheck"`, `short_name: "MedCheck"`, `display: "standalone"`, `background_color: "#090c11"`, `theme_color: "#0e1218"`, `start_url: "/"`, icons 192/512 plus a maskable 512 (the overlap logo on `#090c11`).
- `app/apple-icon.png` (180×180). Add `appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "MedCheck" }` to the root `metadata`.
- Respect `env(safe-area-inset-top)` in the sticky header for standalone mode.
- **Accept:** "Add to Home Screen" on iOS and Android opens full-screen with the right icon and no browser bar.

### WP11 — Motion polish pass
- Home: cards and warnings stagger in (`stagger 0.04`, y 8 → 0, opacity 0 → 1), **from a visible state**. Content must be readable even if JS animation never runs (animate with `initial={false}` on revisits).
- "2 medicines on file": the number counts up on first load.
- Every tappable surface gets a press state (scale 0.98) and a visible focus ring (`--ring`).
- "See the label evidence" disclosure: height auto-animate plus chevron rotate.
- Skeletons (shimmer using `--muted`) for any loading list instead of spinners.
- **Accept:** nothing animates longer than 320 ms except the hero and Venn; reduced motion removes all of it.

### WP12 — Report screen
**Files:** `/patients/[id]/export` page.
- Replace the 2+1 button grid with: a **paper preview** card (render page 1 of the report as an image, or a scaled HTML preview, on a white sheet with a soft shadow, slightly rotated −1°) above **one row of three equal actions**: Preview, Download PDF, Send by email.
- Keep the "Send by email uses your own email app" note.
- **Accept:** the screen shows what the PDF looks like before tapping anything; no lonely tile.

---

## 8. Tier 2 (only after all Tier 1 accepts)

### WP13 — 3D medicine shelf (Spline)
- Spline scene `shelf.splinecode`: a shelf with **6 pre-placed, hidden box slots** (`box_1`…`box_6`), each with states `hidden` → `dropped` (physics or keyframed drop with bounce) and a `linked` state that shows a glowing amber thread object (`link_1_2`, etc.). Pre-build only the links that are needed for the demo pairs, or use one generic thread you reposition with `findObjectByName`.
- In code: on load, for each entry `i` (max 6) `emitEvent("start", "box_" + i)`; set the box label texture/text if Spline text objects allow (otherwise use a generic box and show names in an HTML overlay positioned under the shelf).
- Show it on the home page above the medicine list **only on capable devices**; the list stays the source of truth.
- More than 6 entries: hide the shelf and show the list only.

### WP14 — Label evidence zoom
- If OCR returns bounding boxes: on "See the label evidence", show the user's photo with an amber highlight rectangle over the warning sentence, auto-zoom to it (CSS transform), pinch/drag to explore.
- If not: show the photo and the quoted sentence together, with the sentence highlighted in the quote block, plus a link to DailyMed. Don't fake a highlight position.

### WP15 — Report folds into envelope (Spline)
- A small Spline scene played on "Send by email" (≤ 1.2 s), then hand off to the `mailto:` / share flow. Skip it entirely under reduced motion or FX off.

### WP7-B — Live viewfinder (see WP7).

---

## 9. Tier 3 (stretch)

- **3D acetaminophen molecule** in the evidence drawer (Spline AI generate or primitives; drag to rotate).
- **Gyroscope parallax** on the landing capsules (`DeviceOrientationEvent`; iOS requires `DeviceOrientationEvent.requestPermission()` from a tap. Ask only after the user taps the hero).
- **"Clinic paper" light theme** polish: warm white, label-black type, the same teal/amber.
- **Haptics:** `navigator.vibrate(12)` on capture and when an overlap is found (Android only, no-op elsewhere).
- **Bottom-sheet menu** (`vaul`) replacing the left drawer.
- **Empty state:** a small Spline cabinet whose door opens, plus "Add your first medicine".

---

## 10. Scene specs for the designers (Spline & Unicorn)

Give these to whoever builds the scenes. **Object and variable names must match exactly**, because the code calls them by name.

### 10.1 Spline — `landing-capsules`
- **Objects:** `capsule_left`, `capsule_right` (glass capsules, ~2.3:1 length:width, frosted glass with transmission, slight teal tint on left and amber tint on right), `overlap_glow` (emissive amber sphere/plane at the intersection, starts at opacity 0.2), `camera_main`.
- **Variable:** `merge` (number 0–1, default 0).
- **States:** `apart` (capsules ±0.6 units apart, rotated ∓18°) and `merged` (±0.25 apart, ∓12°, `overlap_glow` at full intensity). Drive the transition from the `merge` variable (variable-change event → state transition, ~1.2 s ease-out).
- **Events:** `mouseDown` on each capsule → short wobble (scale 1 → 1.06 → 1, 300 ms). Gentle idle float (±0.05 units, 4 s loop).
- **Background:** transparent (the Unicorn aurora shows through).
- **Export:** code export → self-host `public/fx/scenes/landing-capsules.splinecode`. Also export a **poster** still at 1080×1080 `.webp` → `public/fx/posters/landing-capsules.webp`.
- **Budget:** keep the `.splinecode` as small as possible (target ≤ 1.5 MB). Low-poly capsules, baked lighting where possible, no heavy post-processing on mobile.

### 10.2 Unicorn Studio — `aurora`
- **Layers:** dark base `#090c11`; 2–3 soft gradient blobs (teal `#2cbbb6`, deep blue `#22445E`, and a hint of amber); slow noise/turbulence distortion; subtle grain.
- **Variable:** `alert` (0–1). At 0 the blobs are teal/blue; at 1 they shift to amber `#f1b04f` / `#35210d`, over ~1.2 s.
- **Interactions:** Appear (fade in 800 ms). Scroll "while scrolling" adds slight drift. Turn mousemove/hover off on mobile (no hover on phones).
- **Settings:** publish in **production mode** (CDN). Embed with lazy-load, `fps 30`, `scale 0.5` on mobile, `dpi 1.5`.
- **Posters:** export two stills: `aurora-teal.webp` and `aurora-amber.webp` (1080×1920). `<SceneSlot>` picks the poster that matches `alert`.

### 10.3 Optional Unicorn — `scan-beam`
- A horizontal glowing line with chromatic fringing and a soft noise trail, driven by variable `progress` (0–1, vertical position). Only use it if it clearly beats the CSS beam.

### 10.4 Spline — `shelf` (Tier 2), `envelope` (Tier 2), `molecule` (Tier 3)
Same rules: named objects, variables/states documented in the scene's description field, self-hosted export, a poster still, and ≤ 1.5 MB each.

---

## 11. Performance budget and QA checklist

**Budgets (home page, mobile, throttled "Fast 4G" in Lighthouse):**
- Performance ≥ 85, LCP < 2.5 s, CLS < 0.05, TBT < 300 ms.
- No more than **one** live WebGL context at a time on phones.
- JS for FX loads **after** first paint (dynamic import plus idle).

**Test matrix (before demo day):**
- [ ] iPhone (Safari) and a **mid-range Android** (Chrome). If it stutters on the Android, reduce `scale`/`fps` or fall back to posters.
- [ ] Light and dark theme on every changed screen.
- [ ] `prefers-reduced-motion: reduce` → no motion, posters only, Venn static.
- [ ] `NEXT_PUBLIC_FX=0` and `?fx=0` → posters only, nothing broken.
- [ ] VoiceOver/TalkBack read the Venn sentence and the warning headline.
- [ ] Contrast AA on warnings, chips and the bottom bar labels.
- [ ] Installed PWA opens standalone; safe areas are correct (notch and home indicator).
- [ ] Slow network: posters appear; scenes never block interaction.
- [ ] No strength is ever summed; no "safe" language or green success on combinations.
- [ ] Blank-on-scroll bug is gone.

---

## 12. Demo-day setup (60-second judge walkthrough)

1. **0–5 s:** Open the installed PWA → logo intro → capsules merge with amber glow: "Two medicines. One ingredient."
2. **5–20 s:** Tap the center **Add** → photograph a real Daytime Cold & Flu box → brackets lock, beam sweeps, three ingredient chips land → confirm each.
3. **20–35 s:** Back home → header aurora warms to amber → (Tier 2) the new box drops onto the shelf, linked to Tylenol.
4. **35–50 s:** Tap the warning → the Venn animates; open "See the label evidence" → the exact label sentence.
5. **50–60 s:** Report tab → paper preview → (Tier 2) the page folds into an envelope. Close on "Evidence, not advice."

Prep checklist:
- [ ] Physical boxes of Tylenol Extra Strength and Daytime Cold & Flu at the table.
- [ ] A fresh guest session with Tylenol already added, so the demo adds the second product live.
- [ ] Open the app once on venue Wi-Fi before judging, so scenes are cached.
- [ ] Know the `?fx=0` fallback if the venue network or device misbehaves.

---

## 13. Suggested team split

| Person | Owns |
|---|---|
| Designer A (Spline) | 10.1 landing-capsules, then 10.4 shelf |
| Designer B (Unicorn) | 10.2 aurora (+ posters), then 10.3 scan-beam if needed |
| Developer / agent session | Phase 0, Phase 1, WP1–WP12 in order; integrates scenes as they arrive (posters first, so dev isn't blocked) |

Developers can integrate with placeholder posters and dummy scene IDs from day one. Scenes slot in later without code changes beyond the IDs and paths.

---

## 14. Definition of done

- All Tier 1 WPs meet their acceptance criteria at 375×812, in light and dark, with FX on, FX off and reduced motion.
- Lighthouse budgets in §11 are met on the home page.
- No change to clinical data, label text or warning detection (diff review confirms).
- Each WP is a separate commit (`ui(WPx): …`) so anything can be reverted on demo morning.
- `docs/ui-plan-findings.md` records the versions, deviations from this plan, and anything left undone.
