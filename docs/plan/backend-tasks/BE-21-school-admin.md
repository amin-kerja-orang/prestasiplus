# BE-21 School admin (M27): dashboards, reports, staff and student management

| Field | Value |
|---|---|
| Size | L |
| Lane | PC-6 (folders: sessions.md section 5) |
| Priority | P1 |
| Wave | 4 |
| Depends on | BE-05, BE-17, BE-19 |
| Parallel with | BE-20, BE-22, BE-26 |
| Owner module | M27 |
| Security review | required (user management by a scoped admin, impersonation) |

## Goal

Everything the Admin Sekolah role needs beyond the shared reports: school dashboard, usage statistics, activity and monthly reports, DSKP heatmap, class list, teacher and student management for the own school, and the Mod Pelajar / impersonation entry points.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/requirements/srs/M27-school-admin.md`, `docs/requirements/urs/M27-school-admin.md`
- `docs/discovery/L06-command-center-sekolah.md`, `docs/discovery/L07-dashboard-admin-sekolah.md`
- Mock: `src/modules/m27-school-admin/mock/handlers/{dashboard,usage,activity,monthly,dskp-heatmap,classes,users-read,users-write,impersonate,index}.ts`, `src/modules/m02-users-schools/mock/school-admin-writes.ts` (messages `MSG_ACCOUNT_INACTIVE`, `MSG_USER_NOT_FOUND`, `MSG_ROLE_NOT_MANAGED`), read models `src/modules/m27-school-admin/mock/read-models/*`; client `src/modules/m27-school-admin/api/*`; mock tests under `src/modules/m27-school-admin/__tests__/{users,dashboard,classes,usage,monthly,activity,heatmap}/**`
- `docs/requirements/v2-portals.md` (Admin Sekolah scope, Mod Pelajar US-15), contract session rules (BE-03)
- BE-05 (users), BE-17 (classes), BE-19 (performance reads) outputs
- Requirements: BE-FR-29; BE-NFR-38 ([URS 9.2](../../requirements/v2-backend-urs.md))
- API catalogue part B3 (teacher, reports, admin): [teacher-reports-admin.md](../../architecture/v2-api-catalogue/teacher-reports-admin.md) (endpoint list, wire conventions and open questions for this card's scope)

## Outputs

- Contract: `packages/contract/src/school-admin/**`
- `apps/api/src/modules/school-admin/**` (no new owner tables; uses the owner repositories)
- Tests under `apps/api/test/school-admin/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/school-admin/**`.
- Prisma file(s): none (no schema change).
- Contract: `packages/contract/src/school-admin/**` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: none.
- Tests: `apps/api/test/school-admin/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/school-admin/`.
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: No Prisma file and no owner table: it composes BE-05, BE-17 and BE-19 services, so it cannot clash with BE-20 or BE-22.

## Endpoints (all 22 M27 mock routes; the base is `/api/admin-sekolah`)

Every route below exists in the mock (verified). Every route is `school_admin` (and `admin`), always filtered to the caller's school.

| Group | Endpoints |
|---|---|
| School reports | `GET /api/admin-sekolah/dashboard`, `GET /api/admin-sekolah/usage`, `GET /api/admin-sekolah/laporan-aktiviti`, `GET /api/admin-sekolah/laporan-bulanan`, `GET /api/admin-sekolah/dskp-heatmap`, `GET /api/admin-sekolah/kelas` |
| Teachers | `GET /api/admin-sekolah/guru`, `GET /api/admin-sekolah/guru/:id`, `GET /api/admin-sekolah/guru/export.csv`, `POST /api/admin-sekolah/guru`, `PUT /api/admin-sekolah/guru/:id`, `POST /api/admin-sekolah/guru/:id/toggle-active`, `POST /api/admin-sekolah/guru/:id/reset-password` |
| Pupils | `GET /api/admin-sekolah/pelajar`, `GET /api/admin-sekolah/pelajar/form-options`, `GET /api/admin-sekolah/pelajar/:id`, `GET /api/admin-sekolah/pelajar/export.csv`, `POST /api/admin-sekolah/pelajar`, `PUT /api/admin-sekolah/pelajar/:id`, `POST /api/admin-sekolah/pelajar/:id/reset-password` |
| Impersonation (pending, see Open question 1) | `POST /api/admin-sekolah/users/:id/impersonate`, `POST /api/admin-sekolah/impersonate/leave` |

## DB tables touched

Via repositories only: `users`, `user_roles`, `schools`, `classrooms`, `enrolments`, performance read models; `audit_events` (writes).

## Acceptance criteria

1. Every route is restricted to `school_admin` (and `admin`) and **always** filtered to the caller's school: a `schoolId` in query or body is ignored or rejected (test), and an out-of-scope user or class id gives 404 with the mock message "Pengguna tidak ditemui.".
2. Creating a teacher or a pupil attaches the caller's school and a valid role; a request that would create or edit a `school_admin`/`admin`, or any account outside the managed roles, is refused 403 "Anda tidak boleh mengurus akaun ini." (mock `MSG_ROLE_NOT_MANAGED`).
3. Toggle-active writes an audit event with the actor and cannot disable the caller's own account; success message "Status pengguna berjaya dikemaskini."; acting on an inactive account follows the mock ("Akaun ini tidak aktif." where `MSG_ACCOUNT_INACTIVE` applies); password reset follows `users-write.ts` and never returns the new password in a log.
4. Reports reproduce the mock's shapes and are computed from tables (replay the cases in the mock tests listed in Inputs that do not depend on live totals); `GET /api/admin-sekolah/laporan-bulanan` handles months with no data (returns the mock's empty shape); `laporan-aktiviti` takes `range` as the mock does.
5. CSV exports (`export.csv`) have the mock header row and neutralise cells beginning with `=`, `+`, `-`, `@`.
6. Impersonation: see Open question 1; until it is answered these two routes are not built, and the PR says so.
7. Roles: any other role gets 403; no session 401; missing CSRF 403 `CSRF_INVALID`.

## Test commands

```
npm run be:test -- apps/api/test/school-admin
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/school-admin/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
4. This card creates no tables; the migration-first checklist (plan section 14.9) does not apply, but no change may break `npm run be:lint:migration` (once BE-34 is merged).
5. Label `security-review` on the PR; list the security decisions and the tests that prove them.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. The mock's M27 impersonation (`menyamar sebagai {name}`, `Anda telah kembali ke akaun pentadbir.`) acts as a specific pupil, while v2 Mod Pelajar (D33b, v2-bijak-spm NFR-06) uses the admin's own identity and the BE-03 session mode. Which one applies to `POST /api/admin-sekolah/users/:id/impersonate` and `.../impersonate/leave`? Working assumption: do not build them; the UI uses `POST /api/session/mode`. Lead to confirm.
2. The mock M27 handlers read pupil and teacher lists from M01/M02 stores; the v2 pupil `class_label` and DELIMa fields are BE-05's. If a mock field has no v2 source, return null and list it in the PR.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-21 (school-admin). Work in this repo clone on branch be/BE-21-school-admin, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-21-school-admin.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-21 by composing the owner repositories (users, classes, performance); do not duplicate their SQL. Confirm the literal route strings in the m27 mock handlers before writing the contract. Impersonation must reuse the BE-03 Mod Pelajar session mode, not a parallel mechanism. Needs a security review.
```
