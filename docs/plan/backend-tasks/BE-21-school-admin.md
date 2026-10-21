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
| Security review | required (user management by a scoped admin, school-risk data of minors, CSV export) |

## Goal

Everything the Admin Sekolah role needs beyond the shared reports: school dashboard, usage statistics, activity and monthly reports, DSKP heatmap, class list, teacher and student management for the own school, and (user decision 2026-10-19, UD-4) the four M18 Amaran Awal routes (school risk page, executive summary, effectiveness report, school CSV). The mock's two impersonation routes are not built (UD-2): Mod Pelajar is `POST /api/session/mode` (BE-03).

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/requirements/srs/M27-school-admin.md`, `docs/requirements/urs/M27-school-admin.md`
- `docs/discovery/L06-command-center-sekolah.md`, `docs/discovery/L07-dashboard-admin-sekolah.md`
- M18 mock (UD-4): `src/modules/m18-ppd-jpn/mock/handlers/amaran.ts`, `src/modules/m18-ppd-jpn/mock/repository/{amaran,risk,scope,stores,types}.ts`, tests `src/modules/m18-ppd-jpn/__tests__/mock/{amaran-endpoints,risk-rules,risk-anchors}.test.ts`; consumer client `src/modules/m27-school-admin/api/amaran.ts`; `docs/requirements/srs/M18-ppd-jpn.md` (section 7 #21, #22, #24, #30, BR-M18-01 to BR-M18-34); catalogue section 9 of [teacher-reports-admin.md](../../architecture/v2-api-catalogue/teacher-reports-admin.md)
- Mock: `src/modules/m27-school-admin/mock/handlers/{dashboard,usage,activity,monthly,dskp-heatmap,classes,users-read,users-write,impersonate,index}.ts`, `src/modules/m02-users-schools/mock/school-admin-writes.ts` (messages `MSG_ACCOUNT_INACTIVE`, `MSG_USER_NOT_FOUND`, `MSG_ROLE_NOT_MANAGED`), read models `src/modules/m27-school-admin/mock/read-models/*`; client `src/modules/m27-school-admin/api/*`; mock tests under `src/modules/m27-school-admin/__tests__/{users,dashboard,classes,usage,monthly,activity,heatmap}/**`
- `docs/requirements/v2-portals.md` (Admin Sekolah scope, Mod Pelajar US-15), contract session rules (BE-03)
- BE-05 (users), BE-17 (classes), BE-19 (performance reads) outputs
- Requirements: BE-FR-29, BE-FR-37; BE-NFR-38 ([URS 9.2](../../requirements/v2-backend-urs.md))
- API catalogue part B3 (teacher, reports, admin): [teacher-reports-admin.md](../../architecture/v2-api-catalogue/teacher-reports-admin.md) (endpoint list, wire conventions and open questions for this card's scope)

## Outputs

- Contract: `packages/contract/src/school-admin/**`
- `apps/api/src/modules/school-admin/**` including `school-admin/amaran/**` (risk model, summary, effectiveness, CSV); no new owner tables, it uses the owner repositories
- Tests under `apps/api/test/school-admin/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/school-admin/**` (including `amaran/`).
- Prisma file(s): none (no schema change).
- Contract: `packages/contract/src/school-admin/**` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: none.
- Tests: `apps/api/test/school-admin/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/school-admin/`.
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: No Prisma file and no owner table: it composes BE-05, BE-17 and BE-19 services, so it cannot clash with BE-20 or BE-22.

## Endpoints (20 of the 22 M27 mock routes under `/api/admin-sekolah`, plus the 4 M18 Amaran routes)

Every route below exists in the mock (verified). The M27 routes are `school_admin` (and `admin`), always filtered to the caller's school. The Amaran routes follow the access rules of AC 8 to 12.

| Group | Endpoints |
|---|---|
| School reports | `GET /api/admin-sekolah/dashboard`, `GET /api/admin-sekolah/usage`, `GET /api/admin-sekolah/laporan-aktiviti`, `GET /api/admin-sekolah/laporan-bulanan`, `GET /api/admin-sekolah/dskp-heatmap`, `GET /api/admin-sekolah/kelas` |
| Teachers | `GET /api/admin-sekolah/guru`, `GET /api/admin-sekolah/guru/:id`, `GET /api/admin-sekolah/guru/export.csv`, `POST /api/admin-sekolah/guru`, `PUT /api/admin-sekolah/guru/:id`, `POST /api/admin-sekolah/guru/:id/toggle-active`, `POST /api/admin-sekolah/guru/:id/reset-password` |
| Pupils | `GET /api/admin-sekolah/pelajar`, `GET /api/admin-sekolah/pelajar/form-options`, `GET /api/admin-sekolah/pelajar/:id`, `GET /api/admin-sekolah/pelajar/export.csv`, `POST /api/admin-sekolah/pelajar`, `PUT /api/admin-sekolah/pelajar/:id`, `POST /api/admin-sekolah/pelajar/:id/reset-password` |
| Amaran Awal (M18, UD-4) | `GET /api/amaran/schools/:id` (query `tingkatan`), `GET /api/amaran/summary` (query `scope`, `schoolId`, `district`, `state`), `GET /api/amaran/effectiveness`, `GET /api/amaran/export/school/:id` (CSV) |
| Not built: user decision 2026-10-19 (UD-2) | ~~`POST /api/admin-sekolah/users/:id/impersonate`~~, ~~`POST /api/admin-sekolah/impersonate/leave`~~ (the mock routes are intentionally not ported; use `POST /api/session/mode`) |

## DB tables touched

Via repositories only: `users`, `user_roles`, `schools`, `classrooms`, `enrolments`, performance read models; `audit_events` (writes).

## Acceptance criteria

1. Every route is restricted to `school_admin` (and `admin`) and **always** filtered to the caller's school: a `schoolId` in query or body is ignored or rejected (test), and an out-of-scope user or class id gives 404 with the mock message "Pengguna tidak ditemui.".
2. Creating a teacher or a pupil attaches the caller's school and a valid role; a request that would create or edit a `school_admin`/`admin`, or any account outside the managed roles, is refused 403 "Anda tidak boleh mengurus akaun ini." (mock `MSG_ROLE_NOT_MANAGED`).
3. Toggle-active writes an audit event with the actor and cannot disable the caller's own account; success message "Status pengguna berjaya dikemaskini."; acting on an inactive account follows the mock ("Akaun ini tidak aktif." where `MSG_ACCOUNT_INACTIVE` applies); password reset follows `users-write.ts` and never returns the new password in a log.
4. Reports reproduce the mock's shapes and are computed from tables (replay the cases in the mock tests listed in Inputs that do not depend on live totals); `GET /api/admin-sekolah/laporan-bulanan` handles months with no data (returns the mock's empty shape); `laporan-aktiviti` takes `range` as the mock does.
5. CSV exports (`export.csv`) have the mock header row and neutralise cells beginning with `=`, `+`, `-`, `@`.
6. The impersonation routes are not built (user decision 2026-10-19, UD-2); a test asserts they do not exist (404). Mod Pelajar goes through BE-03.
7. Roles: any other role gets 403; no session 401; missing CSRF 403 `CSRF_INVALID`.
8. Amaran access (UD-4; mock `AMARAN_ROLES`, BR-M18-01): in B1 the roles that reach `/api/amaran/*` are `admin`, `school_admin` and `teacher` (`ppd_officer` has no endpoints in B1 and gets 403); student, parent and sponsor get 403; no session 401. School access: `admin` any school; `school_admin` own school only; `teacher` own school or a school of a class the teacher owns. An unknown school id is 404 (checked before access); an out-of-scope id is 403 as the mock answers (a listed deviation from the 404 convention; list it in the PR). Error texts are the mock's English defaults ("Unauthenticated.", "This action is unauthorized.", "Not Found.").
9. `GET /api/amaran/schools/:id`: `tingkatan` accepts `T4|T5|4|5` case-insensitively and anything else means no filter; the response has `school`, `levelFilter`, `levelSuffix` (" — Tingkatan n"), `tally` (green, yellow, red, total and integer percentages), `weakness[]` and `pupils[]` ordered by score descending with a 1-based `rank`; the cell texts are the mock's BM strings verbatim ("Purata ketepatan: {n}%", "Tiada data latihan", "Tiada data", "Terakhir aktif: {yyyy-mm-dd}" and the rest in `repository/amaran.ts`).
10. Risk model (BR-M18-13/14), computed from tables at request time, never stored, unit-tested with fixtures: per pupil A = 100 minus the mean practice-session accuracy (100 when there is no session but a last-active date or a mastery record; 50 when none of the three), E = min(100, whole days since last active x 100 / 30) and 100 when never active, M = (10 minus mean mastery level) x 10 and 100 without mastery records; `score = 0.4A + 0.3E + 0.3M` to one decimal; status `on_track` below 40, `watch` below 60, otherwise `high` (labels "On Track", "Perlu Perhatian", "Berisiko Tinggi"). Inactive pupils are included; only practice-mode sessions count; the reserved fixture schools are excluded from district and state roll-ups; `is_test` rows are excluded.
11. `GET /api/amaran/summary`: without `scope` the default is the viewer's own scope (school admin and teacher: own school; admin: the mock's preview scope); `scope=school` needs an integer `schoolId`, otherwise 422 with `fields.schoolId` "The school id is required."; `scope=district` without district and state gives 422 "The district and state are required."; `scope=state` without state gives 422 "The state is required."; any other `scope` gives 422 "The scope must be school, district or state."; district and state scopes are 403 for `school_admin` and `teacher`; a district or state with no schools is 404. `generatedAt` is an epoch-ms number as in the mock; keep that shape unless the contract commit says otherwise and list it as a deviation.
12. `GET /api/amaran/effectiveness` returns the viewer's own school report (cards, doughnut, trend with the BM month abbreviations Jan Feb Mac Apr Mei Jun Jul Ogo Sep Okt Nov Dis, `byType` labels, `byTeacher`, `followUps`, `bySchool`) computed from the intervention store; a viewer without a school gets 403. `GET /api/amaran/export/school/:id` returns `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="amaran-sekolah-{id}-{yyyymmdd}.csv"` (date in Malaysia time), `Cache-Control: no-store`, a UTF-8 BOM, CRLF line ends and the header `Bil,Pelajar,Tingkatan / Kelas,Skor Risiko,Status,Ketepatan,Penglibatan,Penguasaan`; cells starting with `=`, `+`, `-`, `@`, tab or CR are prefixed with `'`; it holds no IC, e-mail or phone; a teacher gets 403; every accepted download writes an `audit_events` row (actor, school, file name) and never personal content.

13. Pending teacher verification (LEAD 2026-10-20, carried from BE-06): a teacher who self-registered is created **inactive, with no school scope and a `pending_school_id`** (BE-06 creates it fail-closed; nothing else reads `pending_school_id` yet). A `school_admin` lists the teachers whose `pending_school_id` equals their own school and can **verify** one — in a single transaction: set the account active, set `school_id` to the admin's school, clear `pending_school_id`, write an `audit_events` row (actor, teacher, school), and notify the teacher. A school_admin may verify only a teacher pending for **their own** school (out-of-scope = 404, no enumeration). Only `school_admin` verifies: `admin` (Admin Pusat) gets 403 on `/admin-sekolah/*` per the contract and activates accounts through M02 user management instead (LEAD 2026-10-21; deviation row). An unverified teacher never gains school scope until verified. Proof: a pending teacher is invisible/locked out until verified; after verification the teacher has the admin's school scope.

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

1. The mock M27 handlers read pupil and teacher lists from M01/M02 stores; the v2 pupil `class_label` and DELIMa fields are BE-05's. If a mock field has no v2 source, return null and list it in the PR.
2. M18 stores (UD-4): the mock keeps `AmaranIntervention` (DATA-M18-01) and `CorrectionSubject` rows. Is `AmaranIntervention` the same store as BE-20's `interventions` table (M12 carries the same intervention types)? Working assumption: read intervention rows through BE-20's service and build the `effectiveness` route after BE-20 merges (return the empty report shape until then and say so in the PR); `weakness[]` is computed from answer-row dimensions, not from a stored `CorrectionSubject`. Lead to confirm.
3. Officers: the mock admits `ppd_officer` and `jpn_officer` to the Amaran family with district and state scopes; the contract has no `jpn_officer` and B1 has no PPD/JPN endpoints. Working assumption: only `admin`, `school_admin`, `teacher` in B1 (AC 8).

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-21 (school-admin). Work in this repo clone on branch be/BE-21-school-admin, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-21-school-admin.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-21 by composing the owner repositories (users, classes, performance); do not duplicate their SQL. Confirm the literal route strings in the m27 mock handlers before writing the contract. Impersonation routes are not built (UD-2). Also implement the four M18 Amaran routes (UD-4) per the card ACs 8 to 12. Needs a security review.
```
