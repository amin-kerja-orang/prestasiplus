# BE-22 Command Center and admin dashboard aggregates (M17, M10 Command Center)

| Field | Value |
|---|---|
| Size | L |
| Lane | PC-6 (folders: sessions.md section 5) |
| Priority | P1 |
| Wave | 4 |
| Depends on | BE-17, BE-19, BE-23 |
| Parallel with | BE-20, BE-21, BE-26 |
| Owner module | M17 (admin dashboard), M10 (teacher Command Center) |

## Goal

The live monitoring views of Guru, Admin Sekolah and Admin Pusat: the Command Center live data and drill-down (school, teacher, class, student), daily activity, predictive/evaluation widgets, badge holders and achievements panels, server status. Scope-aware: the same endpoints answer for teacher (own classes), school admin (own school) and admin (all).

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/requirements/srs/M17-admin-dashboard.md`, `docs/requirements/srs/M10-teacher-class.md` (Command Center sections), `docs/discovery/L06-command-center-sekolah.md`
- Mock M17: `src/modules/m17-admin-dashboard/mock/handlers/{command-center-live,command-center-live-reads,command-center-drill,command-center-drill-scope,command-center-drill-sessions,command-center-drill-views,command-center-drill-data,command-center-daily,index}.ts`; mock tests `src/modules/m17-admin-dashboard/__tests__/{command-center,command-center-board,mock}/**`
- Mock M10: `src/modules/m10-teacher-class/mock/handlers/{command-center,command-center-views,command-center-data,command-center-rules,command-center-peers,command-center-remedial}.ts` (base `/api/guru/command-center`; the remedial routes are BE-18); mock tests `src/modules/m10-teacher-class/__tests__/command-center/**`
- Mock `src/mock/core-data/server-status.ts` (`GET /api/admin/server-status`)
- `docs/architecture/v2-frontend.md` task V2-T33 description (shared Pemantauan > Langsung component) and `docs/requirements/v2-portals.md` (PM-01)
- BE-17, BE-19, BE-23 outputs (badges and achievements come from BE-23's services)
- Requirements: BE-FR-30, BE-FR-33; BE-NFR-15, BE-NFR-40 ([URS 9.2](../../requirements/v2-backend-urs.md))
- API catalogue part B3 (teacher, reports, admin): [teacher-reports-admin.md](../../architecture/v2-api-catalogue/teacher-reports-admin.md) (endpoint list, wire conventions and open questions for this card's scope)

## Outputs

- Contract: `packages/contract/src/admin/command-center.ts` (the PC-6 `admin/` contract folder)
- `apps/api/src/modules/command-center/**` (read services; ETag-friendly polling; **no websockets in B1**; no new tables, the daily activity and live figures are computed by queries as in the mock)
- Tests under `apps/api/test/command-center/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/command-center/**`.
- Prisma file(s): none (no schema change).
- Contract: `packages/contract/src/admin/command-center.ts` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: none.
- Tests: `apps/api/test/command-center/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/command-center/`.
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: No Prisma file; it reads BE-17, BE-19 and BE-23 through their services.

## Endpoints (all 18 M17 and M10 Command Center routes, paths from the mock)

Every route below exists in the mock (verified).

| Group | Endpoints |
|---|---|
| Admin and school live | `GET /api/admin/command-center/live-data` |
| Daily activity | `GET /api/command-center/daily-activity` (`period` = `today`, `week`, `month`; any other value answers with today's figures and echoes the raw value; admin, or school admin forced to the session school), `GET /api/command-center/daily-activity/school/:id` (admin only; a school admin gets 403; unknown school 404) |
| Drill-down | `GET /api/command-center/school/:id`, `GET /api/command-center/school/:sid/teacher/:uid`, `GET /api/command-center/classroom/:id`, `GET /api/command-center/headcount/:configId`, `GET /api/command-center/student/:id`, `GET /api/command-center/student/:id/subject`, `GET /api/command-center/student/:id/week`, `GET /api/command-center/session/:sessionId` |
| Teacher Command Center | `GET /api/guru/command-center/live-data`, `GET /api/guru/command-center/drill`, `GET /api/guru/command-center/evaluate`, `GET /api/guru/command-center/predictive`, `GET /api/guru/command-center/achievements`, `GET /api/guru/command-center/badge-holders` (`badgeId` query: 422 for a bad id, 404 for an unknown badge) |
| Server status | `GET /api/admin/server-status` (build, DB and queue status flags for the status pill; admin only; no secrets) |

## DB tables touched

None of its own. Read-only through services over practice (`PracticeRepository`), reports read models (BE-19), wallet and gamification (BE-11, BE-23), classes (BE-17) and users. The mock keeps no event log for the daily activity (it is computed by queries), so no `activity_events` table is created.

## Acceptance criteria

1. Drill-down obeys scope at every level: a teacher cannot drill into a class they do not own; a school admin cannot leave their school (the mock's `command-center-drill-scope` rules); an out-of-scope id gives 404; role refusals stay 403.
2. Counts are consistent across levels on the seeded data (sum of the children's students equals the parent's figure; test per level); `is_test` data is excluded.
3. Responses support conditional GET (`ETag` / `If-None-Match` gives 304) so the frontend can poll cheaply; personal-data responses carry `Cache-Control: no-store`.
4. `EXPLAIN` of the live-data query is recorded in the PR; p95 under 300 ms (20 runs) on the PoC seed plus 100k generated answer rows on a developer laptop; a missed target is reported as a finding and the missing index is requested from the owning lane by a `cross-lane` issue.
5. `server-status` exposes only status flags and versions, never connection strings, and only to `admin`.
6. Shapes match the mock for the seeded data (replay the mock cases of Inputs that do not depend on live totals); the `period` fallback and the `badgeId` 422/404 cases are tested.
7. Roles: teacher routes need `teacher`; board routes `admin` or `school_admin`; no session 401; GETs only, so no CSRF case.

## Test commands

```
npm run be:test -- apps/api/test/command-center
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/command-center/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
4. This card creates no tables; the migration-first checklist (plan section 14.9) does not apply, but no change may break `npm run be:lint:migration` (once BE-34 is merged).
5. No security review is required; list any security-relevant decision in the PR anyway.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. The v2 portals may merge the three Command Center views into one shared "Pemantauan > Langsung" component (V2-T33). Working assumption: keep the mock's route set; the lead may later add a combined route through a `contract` PR.
2. Pending LEAD decision: OQ-24 of the URS. Plan 14.7 names `mood_checkins` under this card, but no card creates that table (BE-29 does not migrate mood data). Do not add the table until answered. (added 2026-10-19)

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-22 (command-center-admin). Work in this repo clone on branch be/BE-22-command-center-admin, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-22-command-center-admin.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-22. Locate the literal Command Center base path in src/modules/m10-teacher-class/mock/handlers/command-center.ts before authoring the contract. All reads go through owner repositories or documented read-only SQL views; scope is enforced at every drill level. No websockets: use ETag-friendly polling endpoints.
```
