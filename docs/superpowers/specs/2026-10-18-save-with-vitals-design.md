# Save with vitals — design

Date: 2026-10-18. Status: approved.

## What it is

The photo pop-up (spec: photo answers) gets a third choice beside **Don't save** and **Save to My medicines**: **Save with vitals**. It saves the photo's medicines exactly as Save to My medicines does, then opens a short face scan that estimates the person's heart rate and breathing rate with [VitalLens](https://www.rouast.com/api/). The reading joins the person's record and the latest one appears on the medicine report.

MedCheck is for general wellness. The scan adds a little more about the person, in real time; it is not a medical measurement. VitalLens says so itself: "not a medical device and its estimates are not intended for any medical purposes".

## Flow

1. Photo pop-up → its answer card or Together + cards → **Save with vitals**.
2. `savePicksAction({ …, then: "vitals" })` saves the picks and redirects (replace) to `/patients/[patientId]/vitals`. Back from there skips the finished photo, like every finished step.
3. The vitals page: a start screen ("Look at the camera"), then the **front** camera (`facingMode: "user"`) with a face guide and a 30-second countdown. VitalLens's own feedback (hold still, face lost) is shown as it comes.
4. When the scan finishes: each vital with its confidence. **Save reading**, **Scan again**, **Don't save**. Save reading writes the reading and goes to My medicines (replace). Don't save goes there without writing anything; the medicines are already saved either way.

Only the photo pop-up has the button for now (not the review page's Confirm medicine, and no standalone "Check vitals").

## What is measured and kept

- The scan is a live video: a heartbeat changes skin colour too little to see, but VitalLens reads it across ~30 frames a second. A photo cannot carry it.
- The browser sends downsampled frames to VitalLens through MedCheck's proxy while scanning. VitalLens processes and discards them. **MedCheck stores no video, no frame and no face data** — only the numbers.
- `vital_readings` (migration `20261018143757_vital_readings.sql`): `patient_id`, `heart_rate_bpm`, `heart_rate_confidence`, `respiratory_rate_bpm`, `respiratory_rate_confidence`, `method` (`vitallens`), `measured_at`. RLS through the owning patient, like every patient-scoped table; insert and delete are recorded in `history`. Every scan the user saves is kept.

## Confidence and wording (evidence, not advice)

- `src/lib/vitals.ts` turns a VitalLens result into a reading. A value counts only at confidence ≥ **0.8** (the threshold VitalLens's own widgets use) and inside a human range (heart rate 20–250, breathing 2–60); otherwise it is kept as unread and shown as **"Couldn't read clearly"**, with its confidence. A per-frame confidence array is read by its newest value.
- Shown as numbers and confidence only: "Heart rate · 72 bpm · 92% confidence", "Breathing rate · 14 breaths/min · 97% confidence". Never "normal", "high", "low", a range, or any link to a medicine.
- `VITALS_NOTE` goes wherever a reading is shown: "Estimated from a short face video by VitalLens, for general wellness. Not a medical device and not a diagnosis."
- The user reviews the reading and chooses Save reading — the same "AI only suggests, the user confirms" rule as the rest of MedCheck.

## API key and proxy

- The `vitallens` method needs an API key. It is `VITALLENS_API_KEY`, server-only (never `NEXT_PUBLIC_*`), in `.env.local` and Vercel Production.
- The browser's VitalLens client is given `proxyUrl: ${location.origin}/api/vitallens` (it builds URLs with `new URL()`, so it must be absolute). `src/app/api/vitallens/[...path]/route.ts` requires a signed-in user and forwards only `GET resolve-model` and `POST stream` to `https://api.rouast.com/vitallens-v3/…`, adding `x-api-key` and passing `Content-Type`, `X-Encoding`, `X-State`, `X-Model`, `X-Origin`. Same origin, so no CORS.
- The `vitallens` package (~4 MB) is imported on demand (`import("vitallens")`) on the vitals page only.

## Report

`buildReport()` takes the newest reading; the PDF, its preview and the email draft show a **Vitals (estimate)** section: date and time measured, each line, and `VITALS_NOTE`. No reading → no section.

## Errors

- Camera blocked or unavailable → says so, with a link to My medicines (the medicines are saved).
- VitalLens or the proxy fails (network, bad key, free plan used up) → an error with Try again; nothing is saved.
- Face lost during the scan → VitalLens's recovery message; the scan resumes or reports an issue.

## Limits

- Free plan: 20,000 frames a month — about 40 thirty-second scans. Enough for a demo; every rehearsal scan counts.
- Phones allow the camera only on HTTPS (production, or a tunnel), not on a LAN `http://` address.

## Testing

- Vitest: `src/lib/vitals.test.ts` (threshold, ranges, wording never judges, schema), the report's vitals section.
- e2e `e2e/save-with-vitals.spec.ts`: Save with vitals saves the medicine and the vitals page replaces the photo page; the three footer buttons fit a 375 px phone. It never starts a scan (needs a real face and spends quota).
- The scan itself is tested by hand on a phone against production.
