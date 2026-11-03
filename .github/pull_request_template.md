## Card
Closes #<issue>  ·  Card: S?-T??  (exactly one card ID; `scripts/r1-scope-guard.mjs` reads it)  ·  Mode: full | contract-only  ·  Sector: S?
Gap check (link to the issue comment/section):
PRD refs (module / FR / AC):
DM / API IDs (required when this PR adds a page, route, controller, model or migration):
Docs-only PR (touches only `docs/**`; no card needed): yes | no

## What changed (3 lines max)
- ...

Existing files changed (from the card's "Starts from"):
New files and the reason for each (only those the card names):

## Endpoints / tables
- ...

## Other-sector paths touched (owner requested via CODEOWNERS)
- none | path -> sector

## Migration / contract
- Migration number (from my sector range): none | 0???_s?_<slug>
- Contract change: none | contract PR #<n> merged first; `npm run contract:check` output below
- Contract commit: <sha>

## Test evidence (real output)
Checks that exist for this card (AGENT-SYNC section 4): `npm run contract:check`, `npm run typecheck`, `npm test`, and `npm run be:verify` once BE-01 is merged.

```
paste the real tail of the output here (typecheck / lint / test / be:verify)
```

## Scope guard
`node scripts/r1-scope-guard.mjs --base origin/feature/v3-bijak-r1 --head HEAD` result: PASS | WARN (explain) | FAIL (do not open for review)

## Verification evidence (UAT, visible browser, not headless)
- Evidence is kept in local `.evidence/<card>/`; list file names only, never attach images with real names or personal data
- `scrollWidth <= innerWidth` at 375 / 768 / 1280: yes / no
- V2 comparison (same width): differences fixed / deviations numbered:
- UAT data checked on: UAT | UAT-like dataset | demo only (explain)
- ACs proven (IDs and result), and every AC-CHAIN-n through this card:

## Deviations from mock / contract / docs
- none | list (also appended to docs/architecture/v2-backend-deviations.md)

## Open questions for the lead
- none | list

## Checklist
- [ ] Exactly one card ID above; gap check posted before the first commit
- [ ] No rewrite of working code; only the gaps of the gap check changed (FR-X1-5)
- [ ] No parallel page, service, store, route or table for something that exists; no working page or module deleted or rewritten
- [ ] Every schema change has a DM ID and every endpoint an API ID (listed above)
- [ ] Change budget of the card Type respected (Keep/Verify/Ops: no product code under `src/`, `apps/`, `packages/`)
- [ ] Reviewer: a Fix or Complete PR that touches none of its "Starts from" files or adds a parallel implementation is rejected
- [ ] No placeholder strings (akan datang / belum tersedia / Pratonton / prototaip) and no new mock path
- [ ] No secrets, no real names, no personal data in code, seeds, logs, fixtures, docs
- [ ] Scope/role tests included
- [ ] Claim is current (issue assigned to me, board row updated)
- [ ] Definition of Done on the issue is complete
- [ ] Migration-first checklist (plan section 14.9) done; mapping-matrix row added/updated
- [ ] My row(s) in `docs/plan/backend-tracker.md` updated (status, branch, PR, notes)
