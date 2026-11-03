# R1 start here (developers and cloud agents)

One page. Read it, then work one card at a time. Full detail: `docs/plan/r1-development-plan.md` (sections 0A, 0B, 6) and `docs/prd/r1/00-index.md`.

## The rule

**Gap check first, close the gaps, never rebuild.** V3 already contains most of the screens and services. A card is finished when the existing code satisfies the card's acceptance criteria (ACs), not when new code exists.

## Steps

1. **Read `docs/prd/r1/00-index.md`**, then the PRD sections named on your card.
2. **Pick a card** from the GitHub issues: label `r1` + `status:ready` + your sector (`sector:S<n>`), in the current sprint milestone (`R1 Sprint N`). Check that its `deps` are done.
3. **Claim it with a lock** (several Claude accounts may share one GitHub user, so assignees do not identify a team): your team must hold the sector lock (`node scripts/r1-lock.mjs acquire S<n> --team <team-name> --session S-<k>`), then lock the card (`node scripts/r1-lock.mjs acquire S<n>-T<nn> --team <team-name> --session S-<k>`). Exit 3 = another team has it. Mirror it on the issue with label `team:<team-name>` and a comment signed `[<team-name>/S-<k>]`. Heartbeat daily (`heartbeat-all`); release after merge. Full protocol: `docs/plan/R1-ORCHESTRATOR-PROMPT.md` §1.
4. **Code gap check, then post it** as an issue comment before any commit. For every FR/AC of the card write works / broken / missing with `file:line`, starting from the card's "Starts from (existing)" files. Only then move the label to `status:in-progress`.
5. **Close the gaps in the existing files only.** A new file only if the card names it. Branch: `r1/S<n>-T<nn>-<slug>` from `feature/v3-bijak-r1`; commits `S<n>-T<nn>: ...`.
6. **Prove the ACs on UAT** (`uat.prestasiplus.cloud`, a clone of V2 production data) in a visible (headed) browser at 375, 768 and 1280, with no horizontal scroll. Also run every AC-CHAIN-n that passes through your card. Evidence (screenshots, logs) stays in your local `.evidence/<card>/`, which is gitignored. Never put names, e-mails or credentials in GitHub.
7. **Open a PR** (template pre-fills) naming **exactly one card ID**, the gap-check link, existing files changed, the reason for any new file, DM/API IDs, ACs proven, and the scope-guard result. Set the label to `status:in-review`.
8. **Pass CI**: `r1-scope-guard`, `r1-docs` (trace-check, when docs or plan change), and the existing frontend/api jobs (lint, typecheck, unit/integration tests).
9. **Get review**: CODEOWNERS requests the owner of every path you touch; one approval per owner.
10. **Done**: after merge, the Delivery Lead re-runs the ACs on UAT and moves the card to `status:done`. A failed AC sends the card back to `status:in-progress`.

Local checks before pushing:

```
node scripts/r1-scope-guard.mjs --base origin/feature/v3-bijak-r1 --head HEAD
node scripts/r1-trace-check.mjs
```

## Hard rules

- **No rebuilding.** Do not rewrite or delete working code, pages or modules.
- **No parallel pages, services, stores, routes or tables** for something that already exists. Every schema change names a DM ID, every endpoint an API ID.
- **Change budget by card Type**: Keep/Verify/Ops = no product code; Fix/Complete = the "Starts from" files (new file only if the card names it); Build = new files only at the named location.
- **No server access for AI sessions.** V1, V2, V3 and UAT servers are not touched by agents.
- **UAT writes only by the designated developer, and only with the user's approval.** Everyone else uses UAT read-only in the browser.
- No placeholder strings ("akan datang", "belum tersedia", "Pratonton", "prototaip") and no mock path in the http build.
- Public repo: no real person names, e-mails, credentials or personal data in code, seeds, docs, issues or PRs. Use fictitious names.
- Docs-only PRs (touch only `docs/**`) have no card and skip the scope guard.
- Stuck, or the PRD does not answer? Comment on the issue and add `status:blocked`. Do not guess.

## Cloud agent prompt

Give a cloud session this text verbatim, replacing `<CARD>` (for example `S1-T02`):

```
You are working on PrestasiPlus V3, Release 1, on exactly ONE plan card: <CARD>.
Repo: amin-kerja-orang/prestasiplus. Base branch: feature/v3-bijak-r1. Create branch r1/<CARD>-<short-slug> from it.

Before anything else read, in this order:
1. docs/plan/R1-START-HERE.md
2. docs/prd/r1/00-index.md and the PRD sections your card cites
3. Your card in docs/plan/r1-development-plan.md (search for "**<CARD> ") and its GitHub issue.

Rules (mandatory):
- Gap check first. Open every file under the card's "Starts from (existing)". For each FR/AC of the card write works / broken / missing with file:line. Post it as a comment on the card's issue BEFORE your first commit. Do not code until it is posted.
- Close only those gaps, in the existing files. Never rebuild, rewrite or delete working code. No parallel page, service, store, route or table. A new file only if the card names it. Schema changes need a DM ID, endpoints an API ID, as on the card.
- Respect the card Type budget: Keep/Verify/Ops = no product code; Fix/Complete = the Starts-from files; Build = new files only where the card says.
- Do not touch any other card's scope. If you need a change in a file owned by another sector (see .github/CODEOWNERS), stop and comment on the issue.
- No server access: never SSH or call V1, V2, V3 or UAT servers, never write to UAT. Use the local stack (npm run stack:up) and read-only browsing of public pages only.
- Privacy: this repo is public. No real person names, e-mails, credentials or personal data in code, docs, issues or PR text. Screenshots and logs go to local .evidence/<CARD>/ only (gitignored) and are never uploaded.
- If the PRD does not answer a question, stop, comment on the issue with the question, label status:blocked. Do not guess.

Finish with:
- typecheck, lint and tests run locally; paste the real output tails in the PR.
- node scripts/r1-scope-guard.mjs --base origin/feature/v3-bijak-r1 --head HEAD  (must not FAIL)
- node scripts/r1-trace-check.mjs  (if you touched docs or the plan)
- Open a PR to feature/v3-bijak-r1 using the PR template, naming exactly one card ID (<CARD>), the gap-check link, existing files changed, the reason for each new file, DM/API IDs, and the ACs you could prove locally. State clearly that UAT acceptance (headed browser at 375/768/1280) is still to be done by a human with UAT access.
- Do not merge. Do not move the card to Done.
```
