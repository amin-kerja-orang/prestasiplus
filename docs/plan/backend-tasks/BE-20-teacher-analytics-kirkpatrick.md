# BE-20 Teacher analytics, monitoring and Kirkpatrick (M11, M12)

| Field | Value |
|---|---|
| Size | L |
| Lane | PC-6 (folders: sessions.md section 5) |
| Priority | P2 |
| Wave | 4 |
| Depends on | BE-19 |
| Parallel with | BE-21, BE-22, BE-26 |
| Owner module | M11 (monitoring, teacher report), M12 (Kirkpatrick) |

## Goal

The Guru and Admin Sekolah analytics reports: teacher report and item analysis, monitoring overview and export, and the Kirkpatrick levels (Reaksi, Pembelajaran, Tingkah Laku, Hasil, Rantaian Impak, Intervensi) with feedback collection, intervention log, filter options, and PDF/CSV export.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/requirements/srs/M11-teacher-analytics.md`, `docs/requirements/srs/M12-kirkpatrick.md` (and the `urs/` twins)
- Mock M11: `src/modules/m11-teacher-analytics/mock/handlers/{monitoring,report,common,index}.ts`, table `m11.monitoringFlags` (`src/modules/m11-teacher-analytics/mock/tables/*`); mock tests `src/modules/m11-teacher-analytics/__tests__/mock/**`
- Mock M12: `src/modules/m12-kirkpatrick/mock/handlers/{levels,students,feedback,interventions,export,pdf,common,index}.ts`, tables `kirkpatrick.*` (`feedback`, `interventions`, `schoolScores`, `studentConsistency`, `alesaPredictions`; `src/modules/m12-kirkpatrick/mock/tables/*`); mock tests `src/modules/m12-kirkpatrick/__tests__/mock/**`; clients `src/modules/m11-teacher-analytics/api/*`, `src/modules/m12-kirkpatrick/api/*`
- `docs/architecture/v2-data-migration.md` section 4.6 and Q7 (do not migrate sensitive wellbeing data)
- BE-19 `StatsService` and read models, BE-17 repository
- Requirements: BE-FR-28; BE-NFR-38 ([URS 9.2](../../requirements/v2-backend-urs.md))
- API catalogue part B3 (teacher, reports, admin): [teacher-reports-admin.md](../../architecture/v2-api-catalogue/teacher-reports-admin.md) (endpoint list, wire conventions and open questions for this card's scope)
- Data model: [v2-data-model.md](../../architecture/v2-data-model.md) (tables, keys and indexes of this card; being written 2026-10-19)

## Outputs

- Contract: `packages/contract/src/reports/analytics.ts`, `packages/contract/src/reports/kirkpatrick.ts`
- `apps/api/prisma/schema/reports.prisma` additions + migration: `monitoring_flags`, `feedback`, `interventions` (and a cached `kirkpatrick_school_scores` only if the mock persists it; otherwise compute)
- `apps/api/src/modules/reports/analytics/**`, `apps/api/src/modules/reports/kirkpatrick/**`
- PDF export: server-side generation behind a `PdfPort` (use a boring library; the mock `pdf.ts` shows the layout contract)
- Tests under `apps/api/test/analytics/**`, `apps/api/test/kirkpatrick/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/reports/analytics/**`, `apps/api/src/modules/reports/kirkpatrick/**`.
- Prisma file(s): `apps/api/prisma/schema/reports.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/reports/analytics.ts`, `packages/contract/src/reports/kirkpatrick.ts` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: none.
- Tests: `apps/api/test/analytics/**`, `apps/api/test/kirkpatrick/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/analytics/`.
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: reports.prisma was last changed by BE-19 (BE-20 depends on it). BE-21 and BE-22 add no schema, so BE-20, BE-21 and BE-22 can run in parallel.

## Endpoints (all 21 M11 and M12 mock routes, paths from the mock)

Every route below exists in the mock (verified).

| Group | Endpoints |
|---|---|
| Monitoring (M11) | `GET /api/monitoring/overview`, `GET /api/monitoring/export`, `GET /api/monitoring/schools/:schoolId`, `GET /api/monitoring/schools/:schoolId/students/:userId`, `GET /api/monitoring/schools/:schoolId/teachers/:userId` |
| Teacher report (M11) | `GET /api/teacher/report`, `GET /api/teacher/item-analysis` |
| Kirkpatrick levels (M12) | `GET /api/kirkpatrick/overview`, `GET /api/kirkpatrick/reaction`, `GET /api/kirkpatrick/learning`, `GET /api/kirkpatrick/behavior`, `GET /api/kirkpatrick/results`, `GET /api/kirkpatrick/chain`, `GET /api/kirkpatrick/filter-options`, `GET /api/kirkpatrick/me`, `GET /api/kirkpatrick/students/:id` |
| Interventions and export (M12) | `GET /api/kirkpatrick/interventions`, `POST /api/kirkpatrick/interventions`, `GET /api/kirkpatrick/export-pdf` |
| Feedback (M12) | `GET /api/feedback/status`, `POST /api/feedback` |

## DB tables touched

Read: practice, performance, enrolments, wallet; write: `feedback`, `interventions`, `monitoring_flags`.

## Acceptance criteria

1. Shapes match the mock and parse with the contract schemas; figures are computed from tables. Proof: replay the cases of the M11 and M12 mock tests that do not depend on live totals.
2. Visibility follows the access matrix and the mock guards: monitoring and teacher report for admin, teacher and school admin (a school admin is forced to the own school); students use only `GET/POST /api/feedback*` and `GET /api/kirkpatrick/me`; every other combination is 403; no session 401.
3. Scope: Guru sees own classes; Admin Sekolah the own school; for a school admin another school's id, a pupil or teacher of another school and unknown ids all give 404 (existence is not revealed, SRS SEC-M11-02); an invalid export `format` gives 422.
4. Intervention notes are sensitive personal data: not logged, visible to staff in scope only; `faith`, psychometric and wellbeing alert data are **not** modelled (Q7 default).
5. PDF export starts with `%PDF` and has `Content-Type: application/pdf` and a `Content-Disposition` filename; the CSV/XLSX monitoring export has the mock's header row; cells beginning with `=`, `+`, `-`, `@` are neutralised.
6. Feedback (mock `feedback.ts`): one response per user per calendar month (`GET /api/feedback/status` returns `{ month, answered }`); a second `POST` in the same month gives 409 `CONFLICT`; `nps` must be an integer 0 to 10 and `satisfaction` 1 to 5, otherwise 422 with `fields` "Medan ini tidak sah." (blank: "Medan ini diperlukan."); the responder's role and school come from the session, never from the body.
7. Roles on writes: missing CSRF 403 `CSRF_INVALID`.

## Test commands

```
npm run be:test -- apps/api/test/analytics apps/api/test/kirkpatrick
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/analytics/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
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

1. Does `kirkpatrick_school_scores` need persistence (the mock keeps `schoolScores`, `studentConsistency`, `alesaPredictions`)? Working assumption: compute from tables and persist nothing; `alesaPredictions` (M13 AI) stays out of B1.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-20 (teacher-analytics-kirkpatrick). Work in this repo clone on branch be/BE-20-teacher-analytics-kirkpatrick, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-20-teacher-analytics-kirkpatrick.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-20. Reuse the BE-19 statistics service and read models. Port M11/M12 mock handlers; compute figures from tables only. Treat interventions as sensitive personal data (no logging, staff-in-scope only). Do not add wellbeing, psychometric or faith data (v2-data-migration Q7).
```
