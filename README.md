# MedCheck

MedCheck helps anyone managing medicines see when two medicines share an active ingredient, and when two of them disagree on strength or units — and shows each finding as a plain-English warning. **Evidence, not advice.**

Hackathon MVP · Healthcare and Wellness track · acetaminophen first.

## Stack
Next.js 16 · Tailwind + shadcn/ui · Supabase (Postgres, Auth: Google / email code / guest, storage) · Gemini via AI SDK · Vercel.

## Branches
- `dev` — working branch and Vercel production; every feature PR lands here.
- `main` — mirrors what is live, fast-forwarded automatically after each successful `dev` deploy. See `AGENTS.md` § Git.

## Local setup
```bash
npm install
cp .env.example .env.local   # fill in keys (or `vercel env pull .env.local`)
npm run dev
```

## Scripts
`npm run lint` · `npm run typecheck` · `npm test` · `npm run build` · `npm run db:types` · `npm run seed`

Design: `docs/superpowers/specs/2026-10-17-medcheck-design.md`.
