# BE-19 Student performance read models (M08)

| Field | Value |
|---|---|
| Size | L |
| Wave | 3 |
| Depends on | BE-12, BE-17 |
| Parallel with | BE-16, BE-18, BE-23 |
| Owner module | M08 |

## Goal

The performance and analytics reads that Murid, Guru and Admin Sekolah screens use: personal analytics, class/level/school performance, rankings and leaderboard, item analysis, headcount (TOV/RS) setup and entry, the student timeline and the weekly report. Mostly read models over practice answers and enrolments; headcount and timeline are small write stores.

## Inputs (read these)

- `docs/requirements/srs/M08-student-performance.md`, `docs/requirements/urs/M08-student-performance.md`
- Mock: `src/modules/m08-student-performance/mock/handlers/{student,class,performance,item-analysis,headcount,social,common,index}.ts`, tables `m08.*` (`headcountConfigs`, `headcountEntries`, `itemStatistics`, `rankingEntries`, `riskProfiles`, `spRecords`, `spmHistory`, `standings`, `timelinePosts`); client `src/modules/m08-student-performance/api/*`
- `docs/architecture/v2-data-migration.md` section 4.6 (derived data drift, headcount tables)
- ADR-0013/0014 for what is derived vs stored; BE-11 note on `is_test` exclusion

## Outputs

- Contract: `packages/contract/src/performance/**`
- `apps/api/prisma/schema/performance.prisma` + migration: `headcount_configs`, `headcount_entries`, `timeline_posts`, `risk_profiles`, `sp_records`, `spm_history` (only those the mock persists; everything else is computed)
- `apps/api/src/modules/performance/**` using SQL views or `$queryRaw` with indexes; a `StatsService` for percentiles/rank
- Seed: `apps/api/prisma/seed/performance.ts` (headcount configs/entries, timeline posts for the PoC)
- Tests under `apps/api/test/performance/**`

## Endpoints (paths from the mock)

| Method and path | Notes |
|---|---|
| `GET /api/analytics/me`, `GET /api/analytics/classes` | student and teacher analytics |
| `GET /api/performance/classes`, `GET /api/performance/levels`, `GET /api/performance/school` | prestasi by scope |
| `GET /api/item-analysis/classes`, `GET /api/item-analysis/school` | analisa item |
| `GET /api/rankings`, `GET /api/leaderboard` | rankings (scope: class, school, national as the mock) |
| `GET /api/headcounts`, `GET /api/headcounts/dashboard`, `GET /api/headcounts/form-options`, `POST /api/headcounts`, `POST /api/headcounts/auto-setup` | headcount TOV/RS |
| `GET /api/timeline`, `POST /api/timeline` | student timeline |
| `GET /api/weekly-report` | the 403-by-design weekly report (M08 S21: all roles get 403 on live; reproduce the mock) |

## DB tables touched

Read: `practice_answers`, `practice_sessions`, `enrolments`, `classrooms`, `users`, `schools`, `exam_attempts` (scores only). Write: `headcount_*`, `timeline_posts`.

## Acceptance criteria

1. Every endpoint reproduces the mock's response shape; numeric figures are computed from tables (no constants). For the PoC seed, tests assert internal consistency (e.g. class totals = sum of students, ranking order = score order) rather than live totals.
2. Scope: Guru sees own classes, Admin Sekolah own school, Murid own data and public ranks; out-of-scope ids give 404; `is_test` rows are excluded everywhere.
3. Rankings handle ties as the SRS specifies; pagination and `meta.counts` follow the mock.
4. Item analysis reads answer-row dimensions (no live question join) so it survives the bank reload.
5. Headcount auto-setup is idempotent; entry validation (ranges, totals) follows the mock and BM messages.
6. `GET /api/weekly-report` returns exactly the mock's 403 for every role.
7. Dashboard-class queries on 100k generated answer rows complete under 300 ms locally (note in PR).

## Test commands

```
npm run be:test -- apps/api/test/performance
npm run be:verify
```

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-19 (student-performance). Work in this repo clone on branch be/BE-19-student-performance, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10); docs/plan/backend-tasks/BE-19-student-performance.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs.
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-19. Port the computations of the m08 mock handlers to SQL over the real tables, preferring views or $queryRaw with indexes. Do not hard-code any live totals. Exclude is_test rows. Use ClassesRepository (BE-17) and PracticeRepository (BE-12) for access, not their tables, except through read-only SQL views you document in the PR.
```
