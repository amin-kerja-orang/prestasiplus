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

- `docs/requirements/srs/M11-teacher-analytics.md`, `docs/requirements/srs/M12-kirkpatrick.md` (and the `urs/` twins)
- Mock M11: `src/modules/m11-teacher-analytics/mock/handlers/{monitoring,report,common,index}.ts`, table `m11.monitoringFlags`
- Mock M12: `src/modules/m12-kirkpatrick/mock/handlers/{levels,students,feedback,interventions,export,pdf,common,index}.ts`, tables `kirkpatrick.*` (`feedback`, `interventions`, `schoolScores`, `studentConsistency`, `alesaPredictions`); clients `src/modules/m11-*/api/*`, `src/modules/m12-*/api/*`
- `docs/architecture/v2-data-migration.md` section 4.6 and Q7 (do not migrate sensitive wellbeing data)
- BE-19 `StatsService`, BE-17 repository

## Outputs

- Contract: `packages/contract/src/analytics/**`, `packages/contract/src/kirkpatrick/**`
- `apps/api/prisma/schema/analytics.prisma` + migration: `monitoring_flags`, `feedback`, `interventions` (and a cached `kirkpatrick_school_scores` only if the mock persists it; otherwise compute)
- `apps/api/src/modules/analytics/**`, `apps/api/src/modules/kirkpatrick/**`
- PDF export: server-side generation behind a `PdfPort` (use a boring library; the mock `pdf.ts` shows the layout contract) with a test that the file starts with `%PDF`
- Tests under `apps/api/test/analytics/**`, `apps/api/test/kirkpatrick/**`

## Endpoints (paths from the mock)

| Method and path | Notes |
|---|---|
| `GET /api/monitoring/overview`, `GET /api/monitoring/export` | monitoring by scope; export as CSV/XLSX per mock |
| `GET /api/teacher/report`, `GET /api/teacher/item-analysis` | teacher report and item analysis |
| `GET /api/kirkpatrick/{overview,reaction,learning,behavior,results,chain,me,filter-options}` | Kirkpatrick levels and own view |
| `GET /api/kirkpatrick/interventions`, `POST /api/kirkpatrick/interventions` | intervention log |
| `GET /api/kirkpatrick/export-pdf` | PDF export |
| `GET /api/feedback/status`, `POST /api/feedback` | satisfaction survey (student) |

## DB tables touched

Read: practice, performance, enrolments, wallet; write: `feedback`, `interventions`, `monitoring_flags`.

## Acceptance criteria

1. Shapes match the mock and parse with contract schemas; figures are computed from tables.
2. Visibility follows the access matrix: Guru and Admin Sekolah only (admin sees all); students can only use `/feedback*` and `/kirkpatrick/me`; others 403.
3. Scope: Guru sees own classes; Admin Sekolah own school; out-of-scope 404.
4. Intervention notes are treated as sensitive: not logged, visible to staff in scope only; `faith`, psychometric and wellbeing alert data are **not** modelled (Q7 default).
5. PDF export and CSV export open correctly (content-type, filename, header row) and neutralise formula-injection cells.
6. Feedback: one submission per period per student as the mock enforces; status endpoint reflects it.

## Test commands

```
npm run be:test -- apps/api/test/analytics apps/api/test/kirkpatrick
npm run be:verify
```

## Migration-first (plan section 14)

- Every new table that could receive .cloud rows carries `legacy_source`, `legacy_id` and `unique (legacy_source, legacy_id)`, and is added to `apps/api/prisma/migratable-models.json`. Not in the contract.
- Enums are `text` + `check` (English codes); anything the source may lack is nullable or has a documented default.
- Add or update this entity's row in the mapping matrix (plan section 14.7) in the same PR; seeds must not set `legacy_*` and must be idempotent.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-20 (teacher-analytics-kirkpatrick). Work in this repo clone on branch be/BE-20-teacher-analytics-kirkpatrick, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-20-teacher-analytics-kirkpatrick.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-20. Reuse the BE-19 statistics service and read models. Port M11/M12 mock handlers; compute figures from tables only. Treat interventions as sensitive personal data (no logging, staff-in-scope only). Do not add wellbeing, psychometric or faith data (v2-data-migration Q7).
```
