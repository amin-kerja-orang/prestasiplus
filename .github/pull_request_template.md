## Card
Closes #<issue>  ·  Card: S?-T??  (exactly one card ID; `scripts/r1-scope-guard.mjs` reads it)  ·  Sector: S?  ·  Team/session: <team>/S-<k>
Cross-sector: none | `Cross-sector: S<n> (reason)` (only for a small PR that changes another sector's files; also add the label `needs:S<n>`; the team holding S<n> reviews within 1 working day)
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

## Other-sector paths touched
- none | path -> sector (requires the `Cross-sector:` line above)

## Migration / contract
- Migration number (from my sector range): none | 0???_s?_<slug>
- Contract change: none | contract PR #<n> merged first; `npm run contract:check` output below
- Contract commit: <sha>

## Test evidence (real output)
```
paste the real tail of the output here (typecheck / lint / test / be:verify / contract:check)
```

## Scope guard and canonical map
- `node scripts/r1-scope-guard.mjs --base origin/feature/v3-bijak-r1 --head HEAD` result: PASS | WARN (explain) | FAIL (do not open for review)
- `node scripts/r1-canonical-map.mjs --check` result: PASS | FAIL (do not open for review)
- New route / menu entry / model / API: none | listed, with its DM/API ID and the entry in `docs/plan/r1-canonical-map.json` (no parallel implementation of something that already exists)

## ACs and proof
List every AC of the card with a tag: `[CI]` (proven by a named automated test), `[UAT]` (needs UAT data or a human look) or `[CI+UAT]`.
- AC-...: [CI] test name / result
- UI at 375 / 768 / 1280 with no horizontal scroll (`scrollWidth <= innerWidth`): yes / no / not UI
- **ACs awaiting UAT** (run by the card's team after the merge is deployed to UAT; results go in `docs/plan/r1-ac-ledger.md`): <AC and AC-CHAIN IDs>
- Evidence stays in local `.evidence/<card>/`; never attach images or list names, data or credentials from UAT

## Deviations from the PRD text
- none | numbered list

## Open questions for the team lead
- none | list

## Checklist
- [ ] Exactly one card ID above; gap check posted before the first commit
- [ ] No rewrite of working code; only the gaps of the gap check changed (FR-X1-5)
- [ ] No parallel page, service, store, route or table for something that exists (scope guard and canonical map green); no working page or module deleted or rewritten
- [ ] Every schema change has a DM ID and every endpoint an API ID (listed above)
- [ ] Change budget of the card Type respected (Keep/Verify/Ops: no product code under `src/`, `apps/`, `packages/`)
- [ ] Reviewer: a Fix or Complete PR that touches none of its "Starts from" files or adds a parallel implementation is rejected
- [ ] A duplicated stem is shown once and is not excluded from serving; only `stimulus_missing` and `figure_only` questions are excluded (FR-X1-4)
- [ ] No placeholder strings (akan datang / belum tersedia / Pratonton / prototaip) and no new mock path
- [ ] No secrets, no real names, no personal data in code, seeds, logs, fixtures, docs, this PR
- [ ] Scope/role tests included
- [ ] Branch is `r1/<team>/<card>-<slug>`; PR title is `[<team>/S-<k>] <card> <title>`
- [ ] Team lead review comment `[<team>/S-<k>] review: approved` is on this PR (the product owner merges; the card becomes Done only after UAT Pass)
