<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# MedCheck — rules for every agent

Read `docs/superpowers/specs/2026-10-17-medcheck-design.md` and `docs/superpowers/specs/2026-10-17-otc-catalog-design.md` (the OTC catalog, photo match and medicine card; it wins where they disagree) before changing behavior.

## Product boundaries (never cross)
- Evidence, not advice. Never calculate a dose, volume or schedule; never infer a dose from age or weight; never say a combination is "safe"; never pick which product or amount is right.
- `no_finding` is displayed as "No … found in confirmed fields", never "safe", never green.
- AI only suggests. A value counts only after the user confirms or edits it; `pending` and `unknown` fields make dependent checks `unresolved`. For an OTC package photo, confirming the matched catalog product (one tap) confirms that FDA label's values — no per-field review.
- Catalog text is the FDA label's own words, split into bullets by code; never reworded or AI-written.
- Children's dosing tables are shown in full; never highlight a row.
- "I already gave both" always shows the fixed message: contact a pharmacist or Poison Control at 1-800-222-1222 (tap-to-call), nothing else. It is reachable from **Get help** in the header on every page.

## Code map
- `src/lib/domain/schema.ts` — the shared contract (zod + types). Do not change it inside a feature PR; propose changes separately.
- `src/lib/domain/ingredients.ts` — `normalizeIngredient()`; all ingredient comparisons go through it.
- `src/lib/supabase/{client,server,proxy}.ts` — Supabase clients. `createAdminClient()` (secret key) is only for catalog writes.
- `src/lib/supabase/database.types.ts` — generated (`npm run db:types`); never hand-edit.
- `src/lib/auth.ts` — `getCurrentUser()` / `requireUser()`.
- `src/app/actions/session.ts` — the sign-in doors and sign-out: `startGuest`, `startGoogle`, `sendEmailCode`, `verifyEmailCode`, `signOut`.
- `src/app/auth/callback/route.ts` — the OAuth/PKCE callback for Google and for emailed sign-in links.
- `supabase/migrations/` — schema; add new files with `npx supabase migration new <name>`; every table has RLS.
- `src/components/ui/` — shadcn components (`npx shadcn@latest add <name>`). Style `base-nova` = **Base UI, not Radix**: compose with the `render` prop (`<Button render={<Link href="/x" />} nativeButton={false}>`), there is no `asChild`.
- `src/lib/records.ts` — all patient/document/entry/history/photo data access (runs as the user). Use these; don't query tables directly from features. `ensureSelfPatient()` returns the account's one person (relationship `self`), creating it on first use.
- `src/lib/catalog.ts` — catalog reads (`listFormulations`, `getFormulation(s)ByIds`). The catalog holds every US oral OTC label (thousands of rows): never load it whole in a request; search with the `search_formulations` RPC.
- `src/lib/domain/fields.ts` — build/read `EntryFields` (`suggestedField`, `fieldsFromFormulation`, `isUsable`, `isFullyReviewed`, `formatStrength`, `entryLabel`).
- `src/data/fictional-formulations.ts` — fictional formulations (Calmora) with their NDCs.
- `src/lib/photo-flow.ts` — the OTC photo flow's decisions: `photoNextPath()` (package → `/match` or `/retake`; other photos → `/review`), the picker's options, "Save without a match" fields.
- `e2e/fake-gemini.mjs` — the e2e Gemini stand-in (via `GOOGLE_GENERATIVE_AI_BASE_URL`); it picks a canned read by the photo's width (`e2e/fake-gemini-scenarios.mjs`).
- `src/components/already-gave-both.tsx` — the fixed "I already gave both" message; reuse it, never re-word it.
- `src/components/back-link.tsx` — `BackLink` / `goBackTo()`: every "← …" link; goes back in history when the page before is its target (keeps scroll), else opens `href`.
- `src/components/use-back-to-close.ts` — every overlay (sheet, dialog, popover) uses it, so device Back closes it; a link inside calls `release()` and navigates with `replace`.
- `src/lib/add-flow.ts`, `src/components/records/add-flow-bar.tsx` — the add flow's steps and Cancel; add-a-medicine screens show `AddFlowBar` instead of `RecordHeader`.
- `src/lib/page-lookup.ts` — record pages read their person/entry with `findPatient` / `findEntry` and title themselves with `patientMetadata` / `entryMetadata`, so a 404 is titled "Page not found".
- Status colors: `finding`, `unresolved` tokens in `globals.css`.

## Supabase Auth
- The Google provider and the SMTP sender for email codes are configured in the Supabase dashboard (Auth → Providers / SMTP), not in code or env.
- The Magic Link and Confirm signup email templates must contain `{{ .Token }}` so the email carries a one-time code. Supabase only allows template edits once custom SMTP is set; until then the email carries a sign-in link, which lands on `/auth/callback` (it handles both Google and email links), so keep both paths working.
- The built-in Supabase mailer sends only to the project's team members, at about 2 emails an hour. Real users need custom SMTP.

## Conventions
- Next.js 16 App Router, `cacheComponents` off. Middleware is `src/proxy.ts`.
- Server-only modules start with `import "server-only"`. Secrets never in `NEXT_PUBLIC_*`.
- Phone-first layouts that also work at laptop width; tap targets ≥ 44px; works in light and dark.
- A server action that finishes a step (upload, confirm, save, discard) redirects with `RedirectType.replace`, so Back skips the finished step.
- Pure logic gets Vitest tests next to it (`*.test.ts`), written first.
- Before pushing: `npm run lint && npm run typecheck && npm test && npm run build`.

## Git
- `dev` is the working branch **and** Vercel's production branch. Branch `feat/<name>` off `dev`; PR into `dev` (pass `--base dev` — GitHub's default base is `main`). Merging requires the `verify` and `e2e` checks and an up-to-date branch; once green, merge it.
- `main` is a mirror of what is live: `.github/workflows/promote-main.yml` fast-forwards it to each `dev` commit Vercel deploys successfully. Never push to, open PRs into, or merge into `main`. Vercel doesn't build `main` (`vercel.json`) and CI doesn't run on it.
- A failed Vercel build of `dev` leaves the previous production deploy live and `main` untouched; fix forward with a new PR.
- Apply a feature's Supabase migration to the project before merging its PR — merged code goes live immediately.
- Ingredient synonyms live in `normalizeIngredient()`; don't add RxNorm or other external normalization services.
- Commit messages: conventional (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
