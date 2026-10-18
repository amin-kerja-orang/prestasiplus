# BE-07 Seed: core population (schools, users, roles) for the PoC profile

| Field | Value |
|---|---|
| Size | S |
| Wave | 1 |
| Depends on | BE-05 |
| Parallel with | BE-08, BE-11 |
| Owner module | seed (reads M01/M02) |

## Goal

A deterministic, fictitious seed of the PoC population (D45: about 20 students, a few teachers, school admins, one admin) across a few schools, so later cards and the frontend demo have people to log in as. The canonical demo accounts of BE-03 are kept unchanged.

## Inputs (read these)

- `docs/TRACKER.md` D45 and D48; `docs/AKAUN-DEMO.md` (accounts and password, demo only)
- `src/mock/core-data/{accounts,users,schools}.ts`, `src/mock/dataset/data-profile.ts` (what "poc" keeps), `src/mock/server/__tests__/poc-boot.test.ts`
- `docs/architecture/overview.md` section on seeds if present, `docs/adr/0006-determinism-seeds-clock-ids.md`
- BE-02 seed runner, BE-03 `seed/identity.ts`, BE-05 `seed/schools.ts`

## Outputs

- `apps/api/prisma/seed/population.ts` and registration in the seed order
- `apps/api/prisma/seed/fixtures/names.ts` (fictitious name lists only; no real people)
- `apps/api/test/seed/population.spec.ts`

## Endpoints

None.

## DB tables touched

`users`, `user_roles`, `user_scopes`, `schools`.

## Acceptance criteria

1. `npm run be:db:reset && npm run be:db:seed` creates the same rows every run (same ids, names, e-mails, class labels); a second `be:db:seed` changes nothing.
2. Counts: at least 20 students across at least 3 schools in 2 states, at least 4 teachers, 1 school admin per school, 1 admin, 1 dual-role account; every demo account in `docs/AKAUN-DEMO.md` exists with the same role.
3. All names are fictitious and obviously synthetic; e-mails use a reserved domain (`example.test`); no real IC/phone data; passwords are the demo password hash only.
4. Logging in as each seeded role through `POST /api/auth/login` returns the expected `landingPath` and scope level.
5. A guard test fails the build if any seeded name matches a deny-list file the lead keeps outside the repo (optional; if the file is absent the test is skipped).

## Test commands

```
npm run be:db:reset && npm run be:db:seed
npm run be:test -- apps/api/test/seed
npm run be:verify
```

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-07 (seed-core-accounts). Work in this repo clone on branch be/BE-07-seed-core-accounts, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10); docs/plan/backend-tasks/BE-07-seed-core-accounts.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs.
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-07 as a deterministic seed module following the PoC profile (D45) and the demo accounts. Use a seeded PRNG and fictitious name lists; keep the account ids/emails of BE-03 stable. Do not add endpoints.
```
