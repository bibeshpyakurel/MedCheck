<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# MedCheck — rules for every agent

Read `docs/superpowers/specs/2026-10-17-medcheck-design.md` and `docs/superpowers/specs/2026-10-17-otc-catalog-design.md` (the OTC catalog, photo match and medicine card) and `docs/superpowers/specs/2026-10-17-photo-answers-design.md` (one photo → confirm pop-up → quick answers or a comparison) and `docs/superpowers/specs/2026-10-18-medication-dashboard-design.md` (the medicine card as a dashboard over the label's own words; the newest wins where they disagree) before changing behavior.

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
- `src/lib/domain/families.ts` — the reviewed ingredient families (NSAIDs, antihistamines, nasal decongestants, acid reducers, sleep aids): members are `normalizeIngredient()` names, `labelTerm` is how a label's warning names the family, `ownTerm` how a label names its own ingredient's family (Purpose line; NSAID footnote). Add a member only when catalog labels support it.
- `src/lib/compare.ts` — `compareProducts()`: ingredients per product, shared ingredients and same-family pairs, each with the label's own quote (no quote → no family). `checks/family.ts` is the Medicines-page check over the same rules.
- `src/components/compare/ingredient-comparison.tsx` — `IngredientComparison` ("Together"): a Venn for two medicines, a grid for three or more, plus shared/family callouts. Reuse it for any multi-medicine comparison.
- `src/lib/supabase/{client,server,proxy}.ts` — Supabase clients. `createAdminClient()` (secret key) is only for catalog writes.
- `src/lib/supabase/database.types.ts` — generated (`npm run db:types`); never hand-edit.
- `src/lib/auth.ts` — `getCurrentUser()` / `requireUser()`.
- `src/app/actions/session.ts` — the sign-in doors and sign-out: `startGuest`, `startGoogle`, `sendEmailCode`, `verifyEmailCode`, `signOut`.
- `src/app/auth/callback/route.ts` — the OAuth/PKCE callback for Google and for emailed sign-in links.
- `supabase/migrations/` — schema; add new files with `npx supabase migration new <name>`; every table has RLS.
- `src/components/ui/` — shadcn components (`npx shadcn@latest add <name>`). Style `base-nova` = **Base UI, not Radix**: compose with the `render` prop (`<Button render={<Link href="/x" />} nativeButton={false}>`), there is no `asChild`.
- `src/lib/records.ts` — all patient/document/entry/history/photo data access (runs as the user). Use these; don't query tables directly from features. `ensureSelfPatient()` returns the account's one person (relationship `self`), creating it on first use.
- `src/lib/catalog.ts` — catalog reads (`listFormulations`, `getFormulation(s)ByIds`). The catalog holds every US oral OTC label (thousands of rows): never load it whole in a request; search with the `search_formulations` RPC.
- `src/lib/quick-answers.ts` — `quickAnswers(f)`: label bullets picked by keyword/heading rules (never reworded); feeds the card's Good to know. Also the age rules (`ageOf`, `ageGroups`, `splitDirectionsByAge`) and `WARNING_HEAD`.
- `src/lib/medication-facts.ts` — `medicationFacts(f)`: the medicine card's dashboard (ingredient card, uses tiles, directions by form and age with `markRanges()` highlights, warning cards, Good to know). Every line is a `LabelLine` whose `ref` points at its raw label bullet (`resolveRef()`); a test holds that for every fixture label. Rendered by `src/components/medicine-card/` (`MedicineCard`: Quick View / Original FDA label tabs; `actions` and `defaultTab` for callers; shared bits in `label-parts.tsx`).
- `src/lib/domain/fields.ts` — build/read `EntryFields` (`suggestedField`, `fieldsFromFormulation`, `isUsable`, `isFullyReviewed`, `formatStrength`, `entryLabel`).
- `src/data/fictional-formulations.ts` — fictional formulations (Calmora) with their NDCs.
- `src/lib/code-lookup.ts` — `findFormulationByCodes()`: an NDC or barcode number → its one catalog label (catalog package NDCs, then openFDA by UPC). Used by the barcode scanner (`/add/scan`, `src/components/capture/barcode-scanner.tsx`) and by photo extraction for the codes Gemini copies off a package.
- `src/lib/photo-flow.ts` — the OTC photo flow's decisions: `photoNextPath()` (package → `/match` or `/retake`; other photos → `/review`), `PhotoReadResult` (what `uploadPhotoAction` returns), the picker's options, "Save without a match" fields. The user never picks a photo's kind: Gemini returns `documentKind` and `extractIntoDrafts()` saves it on the source document (`otc_package` when unsure or unavailable). A photo is read as soon as it's taken or chosen; `afterRead` in `src/components/capture/photo-capture.tsx` decides what follows: a readable package photo opens the photo pop-up (`opensPhotoAnswers()`), anything else replaces the page with `next`.
- `src/lib/match-groups.ts` — `distinctMatches()`: catalog rows that are the same product (brand ignoring case/punctuation/word order/form words, same ingredients and strengths, same dosage form) collapse to the best-ranked one; `matchChoices()` uses it, so every picker offers distinct products.
- `src/components/photo-answers/` — the photo pop-up over the photo page (one Dialog: bottom sheet on phones, centered from `sm:`): "Is this …?" per medicine (`MedicineChoice`), then the answer card or **Together** + cards (`AnswerResult`), Save to My medicines / Don't save. Its server actions are in `src/app/patients/[patientId]/add/photo/answer-actions.ts` (`photoMatchesAction`, `previewPicksAction` — saves nothing, `savePicksAction`, `discardPhotoAction`); its pure decisions in `src/lib/photo-answers.ts`. Before Save or Don't save it steps back over its own history entries, so the redirect replaces the photo page.
- `src/components/match/` — pieces shared by `/match` and the pop-up: `OptionCard`/`OptionDetails`, `CatalogSearchPanel`, `useCatalogSearch()` (the "Type it in" search).
- `e2e/fake-gemini.mjs` — the e2e Gemini stand-in (via `GOOGLE_GENERATIVE_AI_BASE_URL`); it picks a canned read, with its `documentKind`, by the photo's width (`e2e/fake-gemini-scenarios.mjs`).
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
- Test locally before merging, against the same Supabase project production uses: `vercel env pull .env.local` (or copy another worktree's `.env.local`), then `npm run build && npm start` or `npm run dev`, and `npm run e2e`. That database is production's: create data only as guest users and delete what you create (the e2e suite deletes its users). Supabase allows about 30 guest sign-ins an hour per IP, shared by every worktree on this machine.
- Run e2e on ports of your own: `E2E_PORT=31xx FAKE_GEMINI_PORT=49xx npm run e2e`. Playwright reuses any server already listening on its port, so two worktrees on the defaults (3000 / 3999) silently test each other's code.

## Git
- `dev` is the working branch; production is deployed from it **by hand**. Branch `feat/<name>` off `dev`; PR into `dev` (pass `--base dev` — GitHub's default base is `main`). Merging requires the `verify` and `e2e` checks and an up-to-date branch; once green, merge it.
- **Deploys are manual. Never trigger one unless the user asks.** Vercel builds nothing on push, PR or merge (`vercel.json` `git.deploymentEnabled: false`): there are no PR previews and merging into `dev` doesn't go live. When the user asks, `npm run deploy:prod` deploys the head of `origin/dev` (committed files only) and fast-forwards `main` to it. Vercel's Hobby plan caps deploys per day; don't use `vercel deploy` for previews either.
- `main` is a mirror of what is live, moved only by `npm run deploy:prod`. Never push to, open PRs into, or merge into `main`. CI doesn't run on it.
- A failed deploy leaves the previous production deploy live and `main` untouched; fix forward with a new PR.
- Supabase is shared by local testing and production: a migration applied to the project is live in production at once, whatever is deployed. Keep migrations backward-compatible with the deployed code.
- Ingredient synonyms live in `normalizeIngredient()`; don't add RxNorm or other external normalization services.
- Commit messages: conventional (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
