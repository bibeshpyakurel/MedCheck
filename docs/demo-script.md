# MedCheck live demo script

> **MedCheck is for anyone managing medicines — their own or someone else's. Caregivers are the group that needs it most.**
> It shows when two medicines share an active ingredient, or when a prescription, a discharge list and a bottle disagree, and it turns each finding into a question for a pharmacist. Evidence, not advice.

Two acts. Act 1 is the question everyone has asked ("Can I take NyQuil and Tylenol together?"). Act 2 shows the caregiver depth. The 60-second version is Act 1 plus the report.

Everything shown is synthetic: the "Calmora" products, Riverside Community Pharmacy, Lakeside Children's Hospital, Dr. Jordan Lee and Sam Rivera don't exist. The only real thing is the NyQuil product code.

## Before going on stage

- [ ] **Print the kit** from `/demo-kit` (public, no login needed). Use US Letter at 100% scale ("fit to page" off) with background graphics on. You get 5 pages, one item each:
  1. Bottle A — Calmora Fever Relief, 100 mg per 5 mL (already on Sam's record, so it's a spare)
  2. Bottle B — Calmora Extra Fever Relief, 200 mg per 5 mL (scanned in Act 2)
  3. Prescription label — Riverside Community Pharmacy (photographed in Act 2)
  4. Discharge list — Lakeside Children's Hospital (photographed in Act 2)
  5. Fallback barcode — NyQuil, UPC-A 337000523025 / NDC 37000-523-02 (Act 1, if there's no box)
- [ ] A **real NyQuil box** with the Drug Facts panel visible. If you don't have one, use page 5 for the scan and skip the Drug Facts photo (see Recovery).
- [ ] Lay out the pages in act order: NyQuil box or page 5 → page 4 → page 3 → page 2.
- [ ] **Rehearse once on the real Wi-Fi** with the phone you'll present on. Note which check shows as "couldn't be completed" after the "Can't tell" step (Act 2, step 5). Its wording comes from the checks code, so use the real text in your narration.
- [ ] Take photos of pages 2–4 and the NyQuil Drug Facts panel **tonight** and keep them in the phone's camera roll. They're the fallback if the camera won't cooperate.
- [ ] Start from a fresh session: open the app in a new private tab, or reset the demo household if the build has a reset control.
- [ ] Phone mirrored to the projector, brightness up, Do Not Disturb on, a hotspot ready as backup Wi-Fi.

## Act 1: "Can I take NyQuil and Tylenol together?" (30–60 s)

| # | Tap / do | Have ready | Judges should see | Say |
|---|---|---|---|---|
| 1 | Open `/` → **Try the demo household** | — | Signed in anonymously, no account form. Lands on **Me (Alex)**, with **Tylenol Extra Strength** (acetaminophen 500 mg per caplet) already on file and a "Demo data — synthetic" badge | "I'm Alex. I already take Tylenol. I've got a cold and I'm holding a box of NyQuil." |
| 2 | **Add a medicine** → **Scan barcode** → point at the NyQuil box | NyQuil box (or kit page 5) | The barcode reads straight away and the **FDA label from openFDA** appears: brand, active ingredients, warnings | "One scan, and it pulls the official label. No typing." |
| 3 | **Photograph the Drug Facts panel** → review → **Matches** on each row → confirm | NyQuil box, Drug Facts side | A crop of the photo next to each value it read. Nothing counts until a person taps **Matches** or **Edit** | "AI reads the box, but it only suggests. I confirm every value." |
| 4 | Back on Alex's record | — | An **ingredient overlap** finding: NyQuil and Tylenol Extra Strength both contain acetaminophen. It shows both labels' text, quotes the label's own warning ("Do not use with any other drug containing acetaminophen…"), and gives a ready-to-ask pharmacist question. The **Checks run** panel lists all six checks and what each one found | "MedCheck doesn't say 'safe' or 'unsafe', and it never works out a dose. It shows the evidence and the question to take to a pharmacist." |

## Act 2: caregiver depth (2–3 min)

| # | Tap / do | Have ready | Judges should see | Say |
|---|---|---|---|---|
| 5 | Switch the profile to **Sam** (13), who has **Calmora Fever Relief (Bottle A), 100 mg per 5 mL** on file → **Add a medicine** → **Photo** → photograph the discharge list → review. Tap **Matches** on everything except **one field**, which gets **Can't tell**. Use the **Ondansetron line's strength**, so none of the acetaminophen findings depend on it | Kit page 4 (discharge list) | Two draft medicines from one photo: the acetaminophen line and the ondansetron line. Each value has its crop. The source details are filled in: Lakeside Children's Hospital, 2026-10-16, Dr. Jordan Lee | "Sam just came home from the hospital. Here's the discharge list. When I can't read something, I say so, and MedCheck won't guess." |
| 6 | **Add a medicine** → **Photo** → photograph the prescription label → review → confirm | Kit page 3 (prescription label) | "Acetaminophen oral suspension 160 mg per 5 mL", "Give 2 tsp by mouth every 6 hours as needed for fever", Riverside Community Pharmacy, Dr. Jordan Lee, filled 2026-10-16 | "Then the pharmacy label." |
| 7 | **Add a medicine** → **Scan barcode** → scan Bottle B → **Photograph the Drug Facts panel** → review → confirm | Kit page 2 (Bottle B) | The catalog finds **Calmora Extra Fever Relief (Bottle B), 200 mg per 5 mL** (fictional, labeler 99999), then the photo review | "And the bottle from the cupboard, which a relative bought." |
| 8 | Back on Sam's record. Read the findings, then **Pharmacist report** → **Download PDF** / **Share** / **Email** | — | **Concentration**: 100 mg per 5 mL (Bottle A) vs 200 mg per 5 mL (Bottle B), stated as printed and never turned into a volume. **Document vs bottle**: the discharge list and prescription say 160 mg per 5 mL, the bottle says 100 mg per 5 mL, both dated and not resolved. **Units**: 2 tsp on the prescription vs 10 mL on the discharge list. **One check couldn't be completed** because of the "Can't tell" field, and the panel says why. The report has the medicines with their sources, the checks run, the findings with label text, and the questions to ask. Share opens the phone's share sheet. Email sends it with the PDF attached | "Same liquid, three different numbers. MedCheck doesn't pick the right one. It turns the conflict into questions for the pharmacist and sends them over." |

## 60-second version

Act 1 only (steps 1–4), then **Pharmacist report** → **Download PDF** on Alex's record. Close with: *"Anyone who takes more than one medicine has this question. Caregivers juggling someone else's hospital paperwork have it worst. That's Act 2, and it's in the app."*

## Recovery plan

| Problem | Do this |
|---|---|
| Camera won't open or permission is denied | The photo step falls back to the file picker. Choose the pre-shot photo from the camera roll. |
| Barcode won't scan (glare, focus) | Tilt the page to kill glare and fill about half the frame. If it still fails, use the scanner's **type the NDC** fallback: `37000-523-02` for NyQuil, `99999-200-05` for Bottle B. Or use **Pick from list** and choose the product. |
| No NyQuil box | Scan kit page 5, then **Skip photo**. The entry comes from the FDA label alone. The overlap finding still appears. "Database vs box" stays unresolved because there's no photo, and that's the honest result. |
| Gemini is slow or fails | The photo is kept and every field starts as unknown. Type the values from the sheet you're holding. This shows that nothing is guessed. |
| Wi-Fi drops | Switch to the hotspot. If there's no network at all, show the printed kit and a PDF report exported during rehearsal. Have a screen recording of the rehearsal as the last resort. |
| Everything AI is down | **Add a medicine** → **Describe it** → type `Calmora Extra Fever Relief, acetaminophen 200 mg per 5 mL`. Review shows "From your description, not a label". Don't type phrases like "gave both" or "two doses". They open the fixed "I already gave both" message (pharmacist or Poison Control 1-800-222-1222), and that's a different demo. |
| Wrong profile or leftover data | Open a new private tab → **Try the demo household**. |

## Words to use and to avoid

- Say **"No overlap found in confirmed fields"**. Never say "safe", "fine together" or "the right bottle".
- Never say a volume or dose out loud ("give 5 mL instead"). MedCheck doesn't calculate, and neither do we on stage.
- Say **"MedCheck suggests, you confirm"** whenever AI comes up.

## Measuring extraction accuracy (before the demo)

`demo-assets/expected/*.json` hold the values a perfect extraction of each printed sheet returns. To score a phone photo against them:

```bash
npm run score -- path/to/discharge-photo.jpg demo-assets/expected/discharge-list.json
```

The script runs the app's own extractor (`src/lib/ai/extract-label.ts`, which needs `GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local`) and prints a per-field table plus an accuracy %. Text is compared ignoring case, whitespace and trailing punctuation. Numbers must match exactly. Run it on the rehearsal photos to see which fields to watch on stage.
