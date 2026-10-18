# BE-21 School admin (M27): dashboards, reports, staff and student management

| Field | Value |
|---|---|
| Size | L |
| Wave | 4 |
| Depends on | BE-05, BE-17, BE-19 |
| Parallel with | BE-20, BE-22, BE-26 |
| Owner module | M27 |
| Security review | required (user management by a scoped admin, impersonation) |

## Goal

Everything the Admin Sekolah role needs beyond the shared reports: school dashboard, usage statistics, activity and monthly reports, DSKP heatmap, class list, teacher and student management for the own school, and the Mod Pelajar / impersonation entry points.

## Inputs (read these)

- `docs/requirements/srs/M27-school-admin.md`, `docs/requirements/urs/M27-school-admin.md`
- `docs/discovery/L06-command-center-sekolah.md`, `docs/discovery/L07-dashboard-admin-sekolah.md`
- Mock: `src/modules/m27-school-admin/mock/handlers/{dashboard,usage,activity,monthly,dskp-heatmap,classes,users-read,users-write,impersonate,index}.ts`; client `src/modules/m27-school-admin/api/*`
- `docs/requirements/v2-portals.md` (Admin Sekolah scope, Mod Pelajar US-15), contract session rules (BE-03)
- BE-05 (users), BE-17 (classes), BE-19 (performance reads)

## Outputs

- Contract: `packages/contract/src/school-admin/**`
- `apps/api/src/modules/school-admin/**` (no new owner tables; uses owner repositories; a `school_activity_daily` read view or table only if the mock persists it)
- Tests under `apps/api/test/school-admin/**`

## Endpoints (paths from the mock; `BASE` is the school users base in `users-read.ts`, confirm the literal string)

| Method and path | Notes |
|---|---|
| `GET /api/admin-sekolah/dashboard` (confirm in `dashboard.ts`), `GET /api/admin-sekolah/usage`, `GET /api/admin-sekolah/laporan-aktiviti`, `GET /api/admin-sekolah/laporan-bulanan`, `GET /api/admin-sekolah/dskp-heatmap`, `GET /api/admin-sekolah/kelas` | school reports and class list |
| `GET <BASE>/guru`, `POST <BASE>/guru`, `POST <BASE>/guru/:id/toggle-active` | teacher list/create/toggle for own school |
| `GET <BASE>/pelajar`, `GET <BASE>/pelajar/form-options`, `POST <BASE>/pelajar` | student list/create for own school |
| `POST <BASE>/users/:id/impersonate`, `POST <BASE>/impersonate/leave` | align with the BE-03 session mode (`mod_pelajar`, `isTest`): do not create a second mechanism; if the mock's behaviour conflicts with the contract, stop and ask |

## DB tables touched

Via repositories only: `users`, `user_roles`, `schools`, `classrooms`, `enrolments`, performance read models; `audit_events` (writes).

## Acceptance criteria

1. Every route is restricted to `school_admin` (and `admin`) and **always** filtered to the caller's school; passing another `schoolId` is ignored/rejected (test); out-of-scope ids give 404.
2. Creating a teacher/student attaches the caller's school and a valid role; role escalation (creating a `school_admin`/`admin`) is rejected 403.
3. Toggle-active writes an audit event and cannot disable the caller's own account.
4. Mod Pelajar through these routes uses BE-03 session mode semantics (data stamped `is_test`, return role restored) and is audited.
5. Reports reproduce the mock's shapes and are computed from tables; the monthly report handles months with no data.
6. Exports (if any) are protected against formula injection.

## Test commands

```
npm run be:test -- apps/api/test/school-admin
npm run be:verify
```

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-21 (school-admin). Work in this repo clone on branch be/BE-21-school-admin, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10); docs/plan/backend-tasks/BE-21-school-admin.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs.
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-21 by composing the owner repositories (users, classes, performance); do not duplicate their SQL. Confirm the literal route strings in the m27 mock handlers before writing the contract. Impersonation must reuse the BE-03 Mod Pelajar session mode, not a parallel mechanism. Needs a security review.
```
