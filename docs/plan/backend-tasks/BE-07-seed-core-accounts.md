# BE-07 Seed: core population (schools, users, roles) for the PoC profile

| Field | Value |
|---|---|
| Size | S |
| Lane | PC-1 (folders: sessions.md section 5) |
| Priority | P0 |
| Wave | 1 |
| Depends on | BE-05 |
| Parallel with | BE-08, BE-11 |
| Owner module | seed (reads M01/M02) |

## Goal

A deterministic, fictitious seed of the PoC population (D45: about 20 students, a few teachers, school admins, one admin) across a few schools, so later cards and the frontend demo have people to log in as. The canonical demo accounts of BE-03 are kept unchanged.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/TRACKER.md` D45 and D48; `docs/AKAUN-DEMO.md` (accounts and password, demo only)
- `src/mock/core-data/{accounts,users,schools}.ts`, `src/mock/dataset/data-profile.ts` (what "poc" keeps), `src/mock/server/__tests__/poc-boot.test.ts`
- `docs/architecture/overview.md` (seed notes, if present), `docs/adr/0006-determinism-seeds-clock-ids.md`
- BE-02 seed runner (`--profile`), BE-03 `seed/core/identity.ts`, BE-05 `seed/core/schools.ts`
- Requirements: BE-FR-32 ([URS 9.2](../../requirements/v2-backend-urs.md))

## Outputs

- `apps/api/prisma/seed/core/population.ts` and one registry line in `apps/api/prisma/seed/index.ts` (after identity and schools)
- `apps/api/prisma/seed/core/fixtures/names.ts` (fictitious name lists only; no real people)
- `apps/api/test/seed/population.spec.ts`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/prisma/seed/core/population.ts`, `apps/api/prisma/seed/core/fixtures/**`, `apps/api/prisma/seed/index.ts`.
- Prisma file(s): none (no schema change).
- Contract: none.
- Seeds: `apps/api/prisma/seed/core/population.ts`, plus one line in `apps/api/prisma/seed/index.ts`.
- Tests: `apps/api/test/seed/**`.
- Append-only shared files (one line each, never reorder): `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: Seed-only card; it reads BE-03 and BE-05 tables through their repositories or via Prisma inserts in seed code and changes no schema.

## Endpoints

None.

## DB tables touched

`users`, `user_roles`, `user_scopes`, `schools`.

## Acceptance criteria

1. `npm run be:db:reset && npm run be:db:seed` creates identical rows every run (same ids, names, e-mails, class labels; test compares a hash of the seeded tables across two fresh runs); a second `be:db:seed` on the seeded database changes nothing (row counts and hash unchanged).
2. Counts, asserted by query: at least 20 students across at least 3 schools in 2 states, at least 4 teachers, exactly 1 school admin per school, 1 admin, 1 dual-role account; every account listed in `docs/AKAUN-DEMO.md` exists with the same role and the same e-mail/username as that file.
3. Names are fictitious and obviously synthetic; e-mails use the reserved domain `example.test`, plus `demo.test` for the canonical demo accounts of `docs/AKAUN-DEMO.md`; no IC or phone-shaped real data; passwords are the documented demo password `Demo1234` (hashed) only. A test scans the seed files for any e-mail domain other than `example.test` and fails on one.
4. Logging in as each seeded role through `POST /api/auth/login` returns the expected `landingPath` and scope level (assert against the BE-03 table).
5. The seed never sets `legacy_*` and re-running it after rows with `legacy_source = 'cloud'` exist does not touch them (test inserts one such row first).
6. Optional guard: if a deny-list file path is set in `SEED_NAME_DENYLIST` (kept outside the repo by the lead), no seeded name matches it; when the variable is unset the test is skipped.

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

None known. If you meet a rule that neither the mock, the SRS nor this card states, do not invent it: write it under "Open questions" in the PR, and open a GitHub issue labelled `question` if it blocks you.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-07 (seed-core-accounts). Work in this repo clone on branch be/BE-07-seed-core-accounts, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-07-seed-core-accounts.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-07 as a deterministic seed module following the PoC profile (D45) and the demo accounts. Use a seeded PRNG and fictitious name lists; keep the account ids/emails of BE-03 stable. Do not add endpoints.
```
