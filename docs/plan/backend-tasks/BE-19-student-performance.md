# BE-19 Student performance read models (M08)

| Field | Value |
|---|---|
| Size | L |
| Lane | PC-6 (folders: sessions.md section 5) |
| Priority | P1 |
| Wave | 3 |
| Depends on | BE-12, BE-17 |
| Parallel with | BE-16, BE-18, BE-23 |
| Owner module | M08 |

## Goal

The performance and analytics reads that Murid, Guru and Admin Sekolah screens use: personal analytics, class/level/school performance, rankings and leaderboard, item analysis, headcount (TOV/RS) setup and entry, the student timeline and the weekly report. Mostly read models over practice answers and enrolments; headcount and timeline are small write stores.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/requirements/srs/M08-student-performance.md`, `docs/requirements/urs/M08-student-performance.md`
- Mock: `src/modules/m08-student-performance/mock/handlers/{student,class,performance,item-analysis,headcount,social,common,index}.ts`, tables `src/modules/m08-student-performance/mock/tables/*` (`headcountConfigs`, `headcountEntries`, `itemStatistics`, `rankingEntries`, `riskProfiles`, `spRecords`, `spmHistory`, `standings`, `timelinePosts`); client `src/modules/m08-student-performance/api/*`; mock tests `src/modules/m08-student-performance/__tests__/mock/**`
- `docs/architecture/v2-data-migration.md` section 4.6 (derived data drift, headcount tables)
- ADR-0013/0014 for what is derived vs stored; BE-11 note on `is_test` exclusion
- BE-12 (`PracticeRepository`), BE-17 (`ClassesRepository`) outputs
- Requirements: BE-FR-27, BE-FR-33; BE-NFR-15 ([URS 9.2](../../requirements/v2-backend-urs.md))
- API catalogue part B3 (teacher, reports, admin): [teacher-reports-admin.md](../../architecture/v2-api-catalogue/teacher-reports-admin.md) (endpoint list, wire conventions and open questions for this card's scope)
- Data model: [v2-data-model.md](../../architecture/v2-data-model.md) (tables, keys and indexes of this card; being written 2026-10-19)

## Outputs

- Contract: `packages/contract/src/reports/performance.ts` (and further files in `reports/`)
- `apps/api/prisma/schema/reports.prisma` + migration: `headcount_configs`, `headcount_entries`, `timeline_posts`, `risk_profiles`, `sp_records`, `spm_history` (only those the mock persists; everything else is computed) and the SQL views/indexes the reads need
- `apps/api/src/modules/reports/performance/**` using SQL views or `$queryRaw` with indexes; a `StatsService` for percentiles/rank (exported for BE-20, BE-21, BE-22)
- Seed `apps/api/prisma/seed/poc/performance.ts` (headcount configs/entries, timeline posts for the PoC; one line in the seed registry)
- Tests under `apps/api/test/performance/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/reports/performance/**`.
- Prisma file(s): `apps/api/prisma/schema/reports.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/reports/performance.ts` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: `apps/api/prisma/seed/poc/performance.ts`, plus one line in `apps/api/prisma/seed/index.ts`.
- Tests: `apps/api/test/performance/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/performance/`.
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: reports.prisma is shared with BE-20 (BE-20 depends on BE-19). BE-21 and BE-22 add no tables, so they do not clash with it.

## Endpoints (all 30 M08 mock routes, paths from the mock)

Every route below exists in the mock (verified).

| Group | Endpoints |
|---|---|
| Student and class analytics | `GET /api/analytics/me`, `GET /api/analytics/classes`, `GET /api/performance/students/:userId` |
| Performance by scope | `GET /api/performance/classes`, `GET /api/performance/classes/:id`, `GET /api/performance/levels`, `GET /api/performance/levels/:code`, `GET /api/performance/school` |
| Item analysis | `GET /api/item-analysis/classes`, `GET /api/item-analysis/classes/:id`, `GET /api/item-analysis/school`, `GET /api/item-analysis/school/:schoolId` |
| Rankings and social | `GET /api/rankings`, `GET /api/leaderboard`, `GET /api/public/students/:id`, `GET /api/timeline`, `POST /api/timeline`, `GET /api/weekly-report` |
| Headcount (TOV/RS) | `GET /api/headcounts`, `GET /api/headcounts/dashboard`, `GET /api/headcounts/form-options`, `GET /api/headcounts/:id`, `GET /api/headcounts/:id/summary`, `GET /api/headcounts/:id/export`, `GET /api/headcounts/students/:userId`, `POST /api/headcounts`, `POST /api/headcounts/auto-setup`, `POST /api/headcounts/:id/drop-students`, `POST /api/headcounts/:id/reset`, `DELETE /api/headcounts/:id` |

## DB tables touched

Read: `practice_answers`, `practice_sessions`, `enrolments`, `classrooms`, `users`, `schools`, `exam_attempts` (scores only). Write: `headcount_*`, `timeline_posts`.

## Acceptance criteria

1. Every endpoint reproduces the mock's response shape; numeric figures are computed from tables (no constants). For the PoC seed, tests assert internal consistency (class totals = sum of students, ranking order = score order, headcount summary = sum of entries) and replay the cases of `src/modules/m08-student-performance/__tests__/mock/**` that do not depend on live totals.
2. Scope: Guru sees own classes, Admin Sekolah own school, Murid own data and public ranks; out-of-scope ids give 404; `is_test` rows are excluded everywhere (test with a Mod Pelajar row).
3. Rankings handle ties as the SRS specifies (read BR in `M08` SRS; if silent, Open question 1); pagination and `meta.counts` follow the mock.
4. Item analysis reads answer-row dimensions (no live question join) so it survives the bank reload; a test sets `question_id` null on all rows and the figures stay equal.
5. Headcount: `POST /api/headcounts/auto-setup` is idempotent; creating a duplicate returns 409 with "Headcount Auto untuk kelas, subjek dan tahun ini sudah wujud." (auto) or "Headcount Manual untuk kelas, subjek dan tahun ini sudah wujud." (manual); validation messages are the mock's ("Kelas diperlukan.", "Kelas tidak sah.", "Subjek tidak sah.", "Tingkatan tidak sah.", "Tahun akademik mesti antara 2020 dan 2100.", "Bilangan OTR mesti 2, 3, 4 atau 5.", "Mod pengiraan tidak sah.", "Pilih sekurang-kurangnya seorang murid.", "Tindakan tidak sah.").
6. `GET /api/weekly-report` returns 403 `FORBIDDEN` ("This action is unauthorized.") for every signed-in role and 401 without a session, exactly as the mock (`forbidden()` behind `requireAuth()`).
7. Dashboard-class queries on 100k generated answer rows complete under 300 ms on a developer laptop (median of 20 runs, number recorded in the PR; a miss is a finding, not a blocker).
8. Reports read other lanes' tables only through `PracticeRepository` / `ClassesRepository`, or through read-only SQL views defined in this card's migration and documented in the PR with the columns they depend on (a `cross-lane` issue tells PC-2 which columns must stay).
9. Roles: per the access matrix and the mock guards in each handler file; no session 401; missing CSRF 403 `CSRF_INVALID` on POST/DELETE.

## Test commands

```
npm run be:test -- apps/api/test/performance
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/performance/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
4. Migration-first checklist of plan section 14.9 (items 1 to 6) is complete for every table this card creates. Item 6 (insert a `legacy_source = 'cloud'` row twice through the BE-34 upsert helper and assert one row) applies once BE-34 is merged; state in the PR whether it was available.
5. No security review is required; list any security-relevant decision in the PR anyway.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Migration-first (plan sections 14 and 14.9)

- Follow the checklist of plan section 14.9 (items 1 to 6) for every table listed under "DB tables touched".
- Each table that could receive .cloud rows has `legacy_source text null`, `legacy_id text null` and `unique (legacy_source, legacy_id)`, and is listed in `apps/api/prisma/migratable-models.json`. These columns never appear in the contract or in an API response.
- Enums are `text` + `check` with English codes (no Postgres enum types); anything the source may lack is nullable or has a documented default; seeds never set `legacy_*` and are idempotent.
- Add or update this entity's row in the mapping matrix (plan section 14.7) in the same PR.

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. Ranking tie rule: use the SRS; if the SRS is silent, the mock handler's order.
2. SQL views over `practice_*` tables (another lane's files) are a departure from ADR-0014's service-only rule. Working assumption: allowed for read models only, with the cross-lane issue above.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-19 (student-performance). Work in this repo clone on branch be/BE-19-student-performance, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-19-student-performance.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-19. Port the computations of the m08 mock handlers to SQL over the real tables, preferring views or $queryRaw with indexes. Do not hard-code any live totals. Exclude is_test rows. Use ClassesRepository (BE-17) and PracticeRepository (BE-12) for access, not their tables, except through read-only SQL views you document in the PR.
```
