# BE-17 Classes and teacher basics (M10 part A)

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-6 (folders: sessions.md section 5) |
| Priority | P1 |
| Wave | 2 |
| Depends on | BE-05, BE-08 |
| Parallel with | BE-10, BE-12, BE-15, BE-16 |
| Owner module | M10 (classrooms, enrolments, teacher profile) |

## Goal

Classrooms and enrolments for Guru and Murid: teacher creates a class, students join by code ("Kelas Saya"), teacher student lists, teacher dashboard counters, chapter/topic management for the teacher, plus the shared lookups other modules read (`classes.forTeacher`, `classes.forStudent`, roster, school class list).

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/requirements/srs/M10-teacher-class.md` (BR-M10-01 scope, BR-M10-02 join, section 7 routes), `docs/requirements/urs/M10-teacher-class.md`
- Mock: `src/modules/m10-teacher-class/mock/handlers/{classes,students,dashboard,lookups,student-side,extras,questions,common,index}.ts` (messages are the `MSG` table in `common.ts`), repository `src/modules/m10-teacher-class/mock/repository/*`, tables `m10.classrooms`, `m10.enrolments`, `m10.teacherProfiles`; client `src/modules/m10-teacher-class/api/*`; mock tests `src/modules/m10-teacher-class/__tests__/mock/**`
- `docs/architecture/v2-data-migration.md` section 4.8 (classes: `classrooms`, `classroom_student`)
- `docs/adr/0014-store-ownership-and-repositories.md` (M10 owns class stores; other modules use its repository)
- BE-05 users/schools repositories, BE-08 curriculum repository, BE-03 `ScopeFilter`

## Outputs

- Contract: `packages/contract/src/classes/**`
- `apps/api/prisma/schema/classes.prisma` + migration: `classrooms`, `enrolments`, `teacher_profiles`
- `apps/api/src/modules/classes/**`: `ClassesRepository` (only doorway)
- Seed `apps/api/prisma/seed/poc/classes.ts` (classes and rosters for the BE-07 population, join codes deterministic and fictitious; one line in the seed registry)
- Tests under `apps/api/test/classes/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/classes/**`.
- Prisma file(s): `apps/api/prisma/schema/classes.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/classes/**` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: `apps/api/prisma/seed/poc/classes.ts`, plus one line in `apps/api/prisma/seed/index.ts`.
- Tests: `apps/api/test/classes/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/classes/`.
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: classes.prisma is shared with BE-18 (BE-18 depends on BE-17). The seed lives in the PC-6 `poc/` folder.

## Endpoints (paths from the mock)

Every route below exists in the mock (verified).

| Method and path | Notes |
|---|---|
| `GET /api/guru/classes`, `POST /api/guru/classes`, `GET /api/guru/classes/:id/qr-data` | teacher's classes; create with join code; QR payload of a class |
| `GET /api/guru/students`, `PUT /api/guru/students/:id`, `DELETE /api/guru/students/:id` | roster across own classes; move/enrol/remove a student (class membership changes) |
| `GET /api/guru/dashboard` | teacher dashboard counters |
| `GET /api/guru/chapters`, `POST /api/guru/chapters`, `GET /api/guru/topics`, `POST /api/guru/topics` | teacher curriculum helpers (delegate to the BE-08 repository; M03 stays the owner) |
| `GET /api/kelas-saya`, `POST /api/kelas-saya/join` | student's classes; join by code |
| `GET /api/guru/contributions`, `GET /api/guru/galeri-rajah` | teacher extras present in the mock (`questions.ts`, `extras.ts`); contributions are read through `QuestionsService` |

Missions, remedial, question sets, question papers, DSKP picks and the audio KBAT templates are BE-18; Command Center is BE-22.

## DB tables touched

`classrooms`, `enrolments`, `teacher_profiles`, `users`, `schools` (read), `chapters`/`topics` (via M03 repository).

## Acceptance criteria

1. Join (`POST /api/kelas-saya/join`, mock `joinByCode`): the code is trimmed and compared case-insensitively; a blank `classCode` is 422 `VALIDATION_ERROR` with `fields.classCode` "Sila masukkan kod kelas."; an unknown code is 404 `NOT_FOUND` "Kod kelas tidak sah."; an already enrolled student gets 409 `CONFLICT` "Anda sudah menyertai kelas ini."; success is 201 `{ data: { classroomId } }` with message "Berjaya menyertai kelas {name}."; only `student` (and `admin`) may join, other roles get 403.
2. A teacher sees only own classes (`teacherId`); another teacher's class id gives 404 and, for roster moves, the mock messages "Kelas ini bukan milik anda.", "Pelajar bukan daripada sekolah anda.", "Pelajar sudah berada dalam kelas ini.", "Pelajar tiada dalam kelas ini."; a school admin reads classes of the own school through BE-21, not these routes.
3. Teacher dashboard counters (`GET /api/guru/dashboard`) equal counts computed from the tables for the seeded data (no stored aggregates); `hasMission` is computed through BE-18's service once it exists (false until then; the PR says so).
4. Enrolment respects the school boundary: a student of another school cannot be enrolled by the teacher (message above).
5. `ClassesRepository` exposes the methods other modules need (`forTeacher`, `forStudent`, `roster`, `schoolClasses`, `findByJoinCode`, `memberIds`, `enrol`) with unit tests.
6. Every response parses with the contract schema; the cases of `src/modules/m10-teacher-class/__tests__/mock/**` for these routes give the same status, code and message on the API.
7. Roles: teacher routes need role `teacher` (403 otherwise); no session 401; missing CSRF 403 `CSRF_INVALID`.

## Test commands

```
npm run be:test -- apps/api/test/classes
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/classes/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
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

1. Some M10 inline-create routes (chapters, topics, DSKP) answer HTTP 200 with `{ error: message }` as live (`errorLive` in `common.ts`). Working assumption: the API uses the standard 422/409 error shape and logs the deviation in `v2-backend-deviations.md`; the lead confirms.
2. Creating a class with a join code: the code format is not stated; the mock accepts any length. Working assumption: server-generated, 6 to 8 uppercase alphanumerics, unique.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-17 (classes-teacher). Work in this repo clone on branch be/BE-17-classes-teacher, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-17-classes-teacher.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-17 from the M10 SRS and the m10 mock handlers listed in the card. Expose ClassesRepository as the only doorway to classrooms/enrolments. Scope-filter every query with ScopeFilter. Do not implement missions, remedial, question sets, DSKP posts or the Command Center.
```
