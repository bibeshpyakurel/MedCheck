# MedCheck

MedCheck helps caregivers see when two medicines share an active ingredient, and when a prescription, discharge list and bottle disagree on strength or units — then turns each finding into a clear question for a pharmacist. **Evidence, not advice.**

Hackathon MVP · Healthcare and Wellness track · acetaminophen first.

## Stack
Next.js 16 · Tailwind + shadcn/ui · Supabase (Postgres, anonymous auth, storage) · Gemini via AI SDK · ZXing barcode scanning · Vercel.

## Branches
- `main` — default branch and production (Vercel production). Updated only by `dev → main` PRs, merged by the project owner.
- `dev` — working branch, always the latest; every feature PR lands here first (Vercel preview).

## Local setup
```bash
npm install
cp .env.example .env.local   # fill in keys (or `vercel env pull .env.local`)
npm run dev
```
Camera access needs HTTPS on phones — use the Vercel preview URL, or `npm run dev -- --experimental-https`.

## Scripts
`npm run lint` · `npm run typecheck` · `npm test` · `npm run build` · `npm run db:types` · `npm run seed`

Design: `docs/superpowers/specs/2026-10-17-medcheck-design.md`.
