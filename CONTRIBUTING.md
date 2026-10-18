# Contributing to MedCheck

Thanks for helping. MedCheck deals with people's medicines, so a few rules here are stricter than usual. Please read [Product boundaries](#product-boundaries) before changing any behavior.

## Workflow at a glance

1. **Branch from `dev`**: `git switch -c feat/<name> origin/dev`. Use `fix/`, `docs/` or `chore/` prefixes where they fit.
2. **Read the spec** for the area you're changing ([docs index](docs/README.md)). A behavior change starts with a spec change.
3. **Write tests first** for pure logic (Vitest, `*.test.ts` next to the file).
4. **Run the gate** before pushing:
   ```bash
   npm run lint && npm run typecheck && npm test && npm run build
   ```
5. **Open a PR into `dev`**: `gh pr create --base dev`. GitHub's default base is `main`, which is wrong here.
6. **Merge once green.** `verify` and `e2e` must pass, and the branch must be up to date with `dev`.

Merging doesn't deploy anything. Production is deployed by hand with `npm run deploy:prod`, and only when a maintainer asks. Never push to, open PRs into, or merge into `main`: it mirrors what is live and only the deploy script moves it.

## Product boundaries

These are non-negotiable, and review will block a PR that crosses them:

- **Evidence, not advice.** Never calculate a dose, volume or schedule. Never infer a dose from age or weight. Never say a combination is "safe". Never pick which product or amount is right.
- **No finding isn't "safe".** Show "No … found in confirmed fields". Never "safe", and never green.
- **AI only suggests.** A value counts only after the user confirms or edits it. `pending` and `unknown` values make dependent checks `unresolved`.
- **The label's own words.** Catalog text is the FDA label split into bullets by code. Never reword it or have AI write it. Children's dosing tables are shown whole, with no row highlighted.
- **"I already gave both"** always shows the fixed message (pharmacist or Poison Control, 1-800-222-1222). Reuse `src/components/already-gave-both.tsx`.
- **Vitals are numbers only.** Show numbers, confidence and `VITALS_NOTE`. Never judge a reading or link it to a medicine. Never store video, frames or face data.

## Code conventions

- **Next.js 16** App Router. APIs differ from older versions, so check `node_modules/next/dist/docs/` before relying on memory.
- **UI:** shadcn on **Base UI, not Radix**. Compose with the `render` prop; there is no `asChild`. Layouts are phone-first, tap targets are at least 44 px, and everything works in light and dark.
- **Data:** go through `src/lib/records.ts` and `src/lib/catalog.ts`. Don't query tables directly from features. Never load the whole catalog in a request.
- **Contract:** `src/lib/domain/schema.ts` is shared. Propose changes to it in their own PR.
- **Ingredients:** every comparison goes through `normalizeIngredient()`. Don't add external normalization services.
- **Server code:** server-only modules start with `import "server-only"`. Secrets never go in `NEXT_PUBLIC_*`.
- **Flows:** a server action that finishes a step redirects with `RedirectType.replace`, so Back skips the finished step. Overlays use `useBackToClose()`.
- **Migrations:** `npx supabase migration new <name>`. Every table has RLS. The database is shared with production, so keep migrations backward compatible with the deployed code.
- **Commits:** conventional (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).

The full code map is in [`AGENTS.md`](AGENTS.md#code-map).

## Testing against the shared database

Local runs and e2e talk to the same Supabase project production uses.

- Get env with `vercel env pull .env.local` (maintainers), or fill in `.env.example`.
- Create data **only as guest users**, and delete what you create. The e2e suite deletes its own users.
- Supabase allows about 30 guest sign-ins an hour per IP.
- Run e2e on ports of your own, so parallel checkouts don't test each other's servers:
  ```bash
  E2E_PORT=3100 FAKE_GEMINI_PORT=4900 npm run e2e
  ```
- e2e never calls the real Gemini (it uses `e2e/fake-gemini.mjs`) and never starts a vitals scan, which would spend VitalLens quota.

## Pull request checklist

- [ ] The relevant spec is read, and updated if behavior changed
- [ ] Tests are written first for new pure logic, and `npm test` passes
- [ ] `npm run lint && npm run typecheck && npm run build` pass
- [ ] The UI is checked at 375 px and 1280 px, in light and dark
- [ ] No product boundary is crossed (no dose math, no "safe", label text verbatim)
- [ ] `AGENTS.md`'s code map is updated if you added a module others should reuse
