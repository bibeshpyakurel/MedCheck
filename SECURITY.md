# Security policy

## Reporting a vulnerability

Please **don't open a public issue** for a security problem. Report it privately through GitHub's [private vulnerability reporting](https://github.com/bibeshpyakurel/MedCheck/security/advisories/new) and include:

- what the issue is and where it is (URL, route or file),
- steps to reproduce it,
- what an attacker could do with it.

You'll get an acknowledgement as soon as a maintainer sees it. Please give us a reasonable chance to fix the issue before you disclose it.

## Scope

In scope: the MedCheck web app (this repository) and its deployment at [knowyourdrugs.wiki](https://knowyourdrugs.wiki).

Out of scope: third-party services MedCheck uses (Supabase, Vercel, Google Gemini, openFDA, VitalLens, Resend). Report problems in those to their vendors.

## How MedCheck handles data

| Data | Handling |
|---|---|
| Medicines and documents | Stored in Supabase Postgres under row-level security. Only the signed-in owner can read or write them |
| Label photos | A private Storage bucket. Each user can reach only their own folder |
| Guest sessions | Anonymous accounts. Leaving the session deletes the guest's data |
| Vitals | Only the numbers (heart rate, breathing rate, confidence, time) are stored. Video frames go to VitalLens through a signed-in proxy to be processed. MedCheck never stores video, frames or face data |
| Secrets | API keys are server-only. Nothing secret is exposed through `NEXT_PUBLIC_*` variables |
| AI | Photos are sent to Gemini to be read. Its output is only a suggestion until the user confirms it |

MedCheck is for general information and wellness. It is not a medical device.
