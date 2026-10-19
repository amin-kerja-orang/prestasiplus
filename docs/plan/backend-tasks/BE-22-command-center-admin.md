# BE-22 Command Center and admin dashboard aggregates (M17, M10 Command Center)

| Field | Value |
|---|---|
| Size | L |
| Lane | PC-6 (folders: sessions.md section 5) |
| Priority | P1 |
| Wave | 4 |
| Depends on | BE-17, BE-19 (BE-21 recommended) |
| Parallel with | BE-20, BE-21, BE-26 |
| Owner module | M17 (admin dashboard), M10 (teacher Command Center) |

## Goal

The live monitoring views of Guru, Admin Sekolah and Admin Pusat: the Command Center live data and drill-down (school, teacher, class, student), daily activity, predictive/evaluation widgets, badge holders and achievements panels, server status. Scope-aware: the same endpoints answer for teacher (own classes), school admin (own school) and admin (all).

## Inputs (read these)

- `docs/requirements/srs/M17-admin-dashboard.md`, `docs/requirements/srs/M10-teacher-class.md` (Command Center sections), `docs/discovery/L06-command-center-sekolah.md`
- Mock M17: `src/modules/m17-admin-dashboard/mock/handlers/{command-center-live,command-center-live-reads,command-center-drill,command-center-drill-scope,command-center-drill-sessions,command-center-drill-views,command-center-drill-data,command-center-daily,index}.ts`
- Mock M10: `src/modules/m10-teacher-class/mock/handlers/{command-center,command-center-views,command-center-data,command-center-rules,command-center-peers,command-center-remedial}.ts` (base path constant `BASE` and routes `achievements`, `badge-holders`, `drill`, `evaluate`, `live-data`, `predictive`)
- Mock `src/mock/core-data/server-status.ts` (`GET /api/admin/server-status`)
- `docs/architecture/v2-frontend.md` task V2-T33 description (shared Pemantauan > Langsung component) and `docs/requirements/v2-portals.md` (PM-01)
- BE-17, BE-19, BE-21

## Outputs

- Contract: `packages/contract/src/command-center/**`
- `apps/api/src/modules/command-center/**` (read services; optional Postgres `LISTEN/NOTIFY` or polling-friendly ETag; **no websockets in B1**)
- Tests under `apps/api/test/command-center/**`

## Endpoints (paths from the mock; confirm literals)

| Method and path | Notes |
|---|---|
| `GET /api/admin/command-center/live-data` | admin live data |
| `GET /api/command-center/daily-activity` | daily activity series |
| `GET <M10 CC BASE>/{live-data,drill,evaluate,predictive,achievements,badge-holders}` | teacher/school command center; `drill` takes level and id and returns the next level down |
| `GET /api/admin/server-status` | build/DB/queue status for the status pill (no secrets) |

## DB tables touched

Read-only over practice, performance, wallet, classes, users; optional `activity_events` table if the mock keeps an event log (check `command-center-daily.ts`).

## Acceptance criteria

1. Drill-down obeys scope at every level: a teacher cannot drill into a class they do not own; a school admin cannot leave their school; the response for out-of-scope ids is 404.
2. Counts are consistent across levels (sum of children = parent) on the seeded data; `is_test` data excluded.
3. Responses support conditional GET (`ETag`/`If-None-Match`) so the frontend can poll cheaply; `Cache-Control: no-store` for personal data.
4. Query plans use indexes (record `EXPLAIN` for the live-data query in the PR); p95 under 300 ms on the PoC seed plus a generated 100k answer rows.
5. `server-status` exposes only status flags and versions, never connection strings; admin only.
6. Shapes match the mock for the seeded data.

## Test commands

```
npm run be:test -- apps/api/test/command-center
npm run be:verify
```

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-22 (command-center-admin). Work in this repo clone on branch be/BE-22-command-center-admin, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-22-command-center-admin.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-22. Locate the literal Command Center base path in src/modules/m10-teacher-class/mock/handlers/command-center.ts before authoring the contract. All reads go through owner repositories or documented read-only SQL views; scope is enforced at every drill level. No websockets: use ETag-friendly polling endpoints.
```
