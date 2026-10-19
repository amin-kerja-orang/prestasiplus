# BE-26 Seed: PoC data profile across all carded domains

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-6 (folders: sessions.md section 5) |
| Priority | P2 |
| Wave | 4 |
| Depends on | BE-07, BE-12, BE-16, BE-17, BE-19, BE-23 (the seed modules of earlier cards) |
| Parallel with | BE-20, BE-21, BE-22 |
| Owner module | seed |

## Goal

One command (`npm run be:db:reset && npm run be:db:seed`) that builds a coherent PoC database (D45: about 20 students, a few papers) the frontend can be demoed and e2e-tested against: users, classes, practice history, wallet, Bijak attempts, performance, content. Reconcile the seed modules of the earlier cards into one ordered, deterministic run and add the cross-domain fixtures they could not create alone.

## Inputs (read these)

- `docs/TRACKER.md` D45; `docs/AKAUN-DEMO.md`; `src/mock/dataset/data-profile.ts`; `src/mock/server/__tests__/poc-boot.test.ts`
- `apps/api/prisma/seed/*` from BE-03, 05, 07, 08, 09, 11, 12, 15, 17, 19, 23, 24
- `docs/adr/0006-determinism-seeds-clock-ids.md`, `docs/adr/0013-virtual-datasets.md` (rules about coherence)
- `e2e/fixtures/**`, `e2e/global/**` (what the frontend e2e expects of the demo data)

## Outputs

- `apps/api/prisma/seed/index.ts` ordering and a `--profile=poc|test` option; `apps/api/prisma/seed/fixtures/**` (fictitious)
- `apps/api/prisma/seed/verify.ts`: consistency checks (counts, referential coherence, ledger = wallet)
- `docs/plan/seed-profile.md`: the table of what the PoC profile contains (counts per table), written for the frontend lead to compare with mock expectations
- Tests under `apps/api/test/seed/**`

## Endpoints

None.

## DB tables touched

All seeded tables.

## Acceptance criteria

1. Seeding twice from empty yields identical dumps (hash of `pg_dump --data-only` in a test) and a second run on a seeded db is a no-op.
2. `verify.ts` passes: wallet balances equal ledger sums; every answer row has valid dimensions; enrolments reference existing classes/students; each paper placement references a published question; no orphan rows.
3. Every demo account (`docs/AKAUN-DEMO.md`) can log in and has the data its landing page needs (students have sessions, teachers have classes with rosters, school admins have a school with classes, admin sees non-empty aggregates).
4. No real names, e-mails, phone numbers or IC in any seed; guard test scans seed files for e-mail domains other than `example.test`.
5. Seed time under 60 seconds on a laptop; documented.
6. The seed never runs when `NODE_ENV=production` unless `--force-demo` is passed explicitly.

## Test commands

```
npm run be:db:reset && npm run be:db:seed
npm run be:test -- apps/api/test/seed
npm run be:verify
```

## Programme update (2026-10-19)

- Programme update: may seed one finished intake batch (mock provider output) and one built paper once BE-38/BE-39 exist; not a dependency.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-26 (seed-poc-profile). Work in this repo clone on branch be/BE-26-seed-poc-profile, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-26-seed-poc-profile.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-26. Do not rewrite earlier seed modules; compose them in a documented order and add the cross-domain fixtures plus a verify script. Compare the produced counts with docs/TRACKER.md D45 and the e2e fixtures and list any gap for the lead in docs/plan/seed-profile.md. Fictitious data only.
```
