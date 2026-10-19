# BE-26 Seed: PoC data profile across all carded domains

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-6 (folders: sessions.md section 5) |
| Priority | P2 |
| Wave | 4 |
| Depends on | BE-07, BE-12, BE-16, BE-17, BE-19, BE-23, BE-24 |
| Parallel with | BE-20, BE-21, BE-22 |
| Owner module | seed |

## Goal

One command (`npm run be:db:reset && npm run be:db:seed`) that builds a coherent PoC database (D45: about 20 students, a few papers) the frontend can be demoed and e2e-tested against: users, classes, practice history, wallet, Bijak attempts, performance, content. Reconcile the seed modules of the earlier cards into one ordered, deterministic run and add the cross-domain fixtures they could not create alone.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/TRACKER.md` D45; `docs/AKAUN-DEMO.md`; `src/mock/dataset/data-profile.ts`; `src/mock/server/__tests__/poc-boot.test.ts`
- Seed modules created by earlier cards under `apps/api/prisma/seed/` (BE-03 `core/identity.ts`, BE-05 `core/schools.ts`, BE-07 `core/population.ts`, BE-08 `curriculum.ts`, BE-09 `questions.ts`, BE-11 `wallet.ts`, BE-12 `practice.ts`, BE-15 `exam.ts`, BE-17 `poc/classes.ts`, BE-19 `poc/performance.ts`, BE-23 `gamification.ts`, BE-24 `content.ts`)
- `docs/adr/0006-determinism-seeds-clock-ids.md`, `docs/adr/0013-virtual-datasets.md` (rules about coherence)
- `e2e/fixtures/**`, `e2e/global/**` (what the frontend e2e expects of the demo data)
- Requirements: BE-FR-32; BE-NFR-15, BE-NFR-20 ([URS 9.2](../../requirements/v2-backend-urs.md))

## Outputs

- `apps/api/prisma/seed/poc/index.ts` (the `poc` profile: one registry line in `apps/api/prisma/seed/index.ts` that orders the earlier seed modules; the `--profile=poc|test` option itself comes from the BE-02 runner), `apps/api/prisma/seed/poc/fixtures/**` (fictitious cross-domain fixtures)
- `apps/api/prisma/seed/poc/verify.ts`: consistency checks (counts, referential coherence, ledger = wallet)
- `docs/plan/seed-profile.md`: the table of what the PoC profile contains (counts per table), written for the frontend lead to compare with mock expectations
- Tests under `apps/api/test/seed/poc.spec.ts`
- Optional, if BE-38/BE-39 have merged (not a dependency): one finished intake batch from the mock provider and one built paper

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/prisma/seed/poc/**`, `apps/api/prisma/seed/index.ts`, `docs/plan/seed-profile.md`.
- Prisma file(s): none (no schema change).
- Contract: none.
- Seeds: `apps/api/prisma/seed/poc/index.ts`, `apps/api/prisma/seed/poc/verify.ts`, plus one line in `apps/api/prisma/seed/index.ts`.
- Tests: `apps/api/test/seed/**`.
- Append-only shared files (one line each, never reorder): `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: Seed-only card; BE-07 shares `apps/api/test/seed/` (different files). It changes no schema.

## Endpoints

None.

## DB tables touched

All seeded tables.

## Acceptance criteria

1. Seeding twice from an empty database yields identical content: a test computes a hash over every seeded table read in primary-key order (no dependence on `pg_dump` being installed), and a second `be:db:seed` on a seeded database is a no-op (hash and row counts unchanged).
2. `verify.ts` passes: wallet balance equals ledger sum for every user; every answer row has valid dimensions; enrolments reference existing classes and students; each paper placement references a published question; no orphan rows (one SQL assertion per rule, each with a failing-fixture test).
3. Every demo account in `docs/AKAUN-DEMO.md` can log in and has the data its landing page needs: students have practice sessions, teachers have classes with rosters, school admins have a school with classes, admin sees non-empty aggregates (test logs in as each and calls one read endpoint per role).
4. Counts match D45 (about 20 students, a few papers) and the `docs/plan/seed-profile.md` table equals the actual counts (a test regenerates the table and compares); every gap versus `e2e/fixtures/**` expectations is listed in that document.
5. No real names, e-mails, phone numbers or IC in any seed; a guard test scans seed files for e-mail domains other than the allowed reserved domains `example.test` and `demo.test` (the canonical demo accounts of `docs/AKAUN-DEMO.md` use `demo.test`).
6. Seed time is under 60 seconds on a developer laptop (measured and written in `seed-profile.md`).
7. The seed refuses to run when `NODE_ENV=production` unless `--force-demo` is passed explicitly (test for both).

## Test commands

```
npm run be:db:reset && npm run be:db:seed
npm run be:test -- apps/api/test/seed
npm run be:verify
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green. Paste the real tail of the output in the PR.
3. This card has no HTTP endpoints, so it adds no conformance scenarios; after BE-31 merges, `npm run be:test -- apps/api/test/conformance` must still pass.
4. This card creates no tables; the migration-first checklist (plan section 14.9) does not apply, but no change may break `npm run be:lint:migration` (once BE-34 is merged).
5. No security review is required; list any security-relevant decision in the PR anyway.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. Seed time and the D45 counts are targets from the TRACKER; if the earlier seed modules cannot meet them, report the gap in seed-profile.md instead of inventing data.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-26 (seed-poc-profile). Work in this repo clone on branch be/BE-26-seed-poc-profile, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-26-seed-poc-profile.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-26. Do not rewrite earlier seed modules; compose them in a documented order and add the cross-domain fixtures plus a verify script. Compare the produced counts with docs/TRACKER.md D45 and the e2e fixtures and list any gap for the lead in docs/plan/seed-profile.md. Fictitious data only.
```
