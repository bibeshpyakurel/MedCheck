# MedCheck documentation

Start with the [project README](../README.md) for what MedCheck does and how to run it. This folder holds everything deeper.

## Start here

| Doc | Read it when |
|---|---|
| [Architecture](architecture.md) | You want the system overview, data model, request flows and check engine in one place |
| [Contributing](../CONTRIBUTING.md) | You're about to open a branch or a PR |
| [Security](../SECURITY.md) | You found a vulnerability, or want to know how data is handled |
| [`AGENTS.md`](../AGENTS.md) | You need the module-by-module code map, or you're an AI coding agent |

## Design specs

The source of truth for behavior. Read the relevant spec before changing a feature. Where two specs disagree, the later one wins.

| Date | Spec | What it covers |
|---|---|---|
| 2026-10-17 | [MedCheck design](superpowers/specs/2026-10-17-medcheck-design.md) | The foundation: scope, stack, data model, check engine, screens, sign-in |
| 2026-10-17 | [OTC catalog](superpowers/specs/2026-10-17-otc-catalog-design.md) | Every US oral OTC label in the catalog, one-tap photo match, the medicine card |
| 2026-10-17 | [Photo answers](superpowers/specs/2026-10-17-photo-answers-design.md) | One photo → "Is this …?" pop-up → answers, or **Together** for two or more medicines |
| 2026-10-18 | [Medicine dashboard](superpowers/specs/2026-10-18-medication-dashboard-design.md) | The medicine card as a dashboard over the label's own words (Quick View / Original FDA label) |
| 2026-10-18 | [Compare with my medicines](superpowers/specs/2026-10-18-compare-with-my-medicines-design.md) | Comparing a card's medicine with the person's saved medicines |
| 2026-10-18 | [Save with vitals](superpowers/specs/2026-10-18-save-with-vitals-design.md) | An optional VitalLens face scan after saving. Numbers only |

## Implementation plans

Step-by-step build plans written before each feature. They're kept as a record and aren't kept up to date afterwards.

- [M1: feature flow](superpowers/plans/2026-10-17-medcheck-m1.md)
- [Medicine dashboard](superpowers/plans/2026-10-18-medication-dashboard.md)
- [Compare with my medicines](superpowers/plans/2026-10-18-compare-with-my-medicines.md)
- [UI/UX upgrade plan](ui-plan.md) and its [Phase 0 findings](ui-plan-findings.md)

## Assets

[`assets/`](assets/) holds the README banner and the app screenshots (390 px phone, light and dark). Retake the screenshots when a pictured screen changes. Run them against a local build with the e2e fake Gemini, as a guest user, and delete that user afterwards.
