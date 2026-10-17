<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# MedCheck — rules for every agent

Read `docs/superpowers/specs/2026-10-17-medcheck-design.md` before changing behavior.

## Product boundaries (never cross)
- Evidence, not advice. Never calculate a dose, volume or schedule; never infer a dose from age or weight; never say a combination is "safe"; never pick which bottle/amount is right.
- `no_finding` is displayed as "No … found in confirmed fields", never "safe", never green.
- AI only suggests. A value counts only after the user confirms or edits it; `pending` and `unknown` fields make dependent checks `unresolved`.
- Children's dosing tables are shown in full; never highlight a row.
- "I already gave both" always shows the fixed message: contact a pharmacist or Poison Control at 1-800-222-1222 (tap-to-call), nothing else.

## Code map
- `src/lib/domain/schema.ts` — the shared contract (zod + types). Do not change it inside a feature PR; propose changes separately.
- `src/lib/domain/ingredients.ts` — `normalizeIngredient()`; all ingredient comparisons go through it.
- `src/lib/supabase/{client,server,proxy}.ts` — Supabase clients. `createAdminClient()` (secret key) is only for catalog writes.
- `src/lib/supabase/database.types.ts` — generated (`npm run db:types`); never hand-edit.
- `src/lib/auth.ts` — `getCurrentUser()` / `requireUser()`.
- `supabase/migrations/` — schema; add new files with `npx supabase migration new <name>`; every table has RLS.
- `src/components/ui/` — shadcn components (`npx shadcn@latest add <name>`).
- Status colors: `finding`, `unresolved` tokens in `globals.css`.

## Conventions
- Next.js 16 App Router, `cacheComponents` off. Middleware is `src/proxy.ts`.
- Server-only modules start with `import "server-only"`. Secrets never in `NEXT_PUBLIC_*`.
- Phone-first layouts that also work at laptop width; tap targets ≥ 44px; works in light and dark.
- Pure logic gets Vitest tests next to it (`*.test.ts`), written first.
- Before pushing: `npm run lint && npm run typecheck && npm test && npm run build`.

## Git
- Branch `feat/<name>` off `dev`; PR into `dev`. Never push to or open PRs into `main` — the user merges `dev → main`.
- Commit messages: conventional (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
