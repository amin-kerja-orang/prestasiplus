# BE-17 Classes and teacher basics (M10 part A)

| Field | Value |
|---|---|
| Size | M |
| Wave | 2 |
| Depends on | BE-05, BE-08 |
| Parallel with | BE-10, BE-12, BE-15, BE-16 |
| Owner module | M10 (classrooms, enrolments, teacher profile) |

## Goal

Classrooms and enrolments for Guru and Murid: teacher creates a class, students join by code ("Kelas Saya"), teacher student lists, teacher dashboard counters, chapter/topic management for the teacher, plus the shared lookups other modules read (`classes.forTeacher`, `classes.forStudent`, roster, school class list).

## Inputs (read these)

- `docs/requirements/srs/M10-teacher-class.md`, `docs/requirements/urs/M10-teacher-class.md`
- Mock: `src/modules/m10-teacher-class/mock/handlers/{classes,students,dashboard,lookups,student-side,extras,common,index}.ts`, tables `m10.classrooms`, `m10.enrolments`, `m10.teacherProfiles`; client `src/modules/m10-teacher-class/api/*`
- `docs/architecture/v2-data-migration.md` section 4.8 (classes: `classrooms`, `classroom_student`)
- `docs/adr/0014-store-ownership-and-repositories.md` (M10 owns class stores; other modules use its repository)
- BE-05 users/schools repositories, BE-03 `ScopeFilter`

## Outputs

- Contract: `packages/contract/src/classes/**`
- `apps/api/prisma/schema/classes.prisma` + migration: `classrooms`, `enrolments`, `teacher_profiles`
- `apps/api/src/modules/classes/**`: `ClassesRepository` (only doorway)
- Seed: `apps/api/prisma/seed/classes.ts` (classes and rosters for the BE-07 population, join codes deterministic and fictitious)
- Tests under `apps/api/test/classes/**`

## Endpoints (paths from the mock)

| Method and path | Notes |
|---|---|
| `GET /api/guru/classes`, `POST /api/guru/classes` | teacher's classes; create with join code |
| `GET /api/guru/students` | roster across own classes |
| `GET /api/guru/dashboard` | teacher dashboard counters |
| `GET /api/guru/chapters`, `POST /api/guru/chapters`, `GET /api/guru/topics`, `POST /api/guru/topics` | teacher curriculum helpers (delegate to the M03 repository; M03 stays the owner) |
| `GET /api/kelas-saya`, `POST /api/kelas-saya/join` | student's classes; join by code with the mock's errors |
| `GET /api/guru/contributions`, `GET /api/guru/galeri-rajah` | teacher extras present in `extras.ts` |

Missions, remedial, question sets and DSKP posts are BE-18; Command Center is BE-22.

## DB tables touched

`classrooms`, `enrolments`, `teacher_profiles`, `users`, `schools` (read), `chapters`/`topics` (via M03 repository).

## Acceptance criteria

1. Join code: case-insensitive, single-use per student per class, wrong or inactive code returns the mock error and BM message; a student already enrolled gets the mock's conflict response.
2. A teacher sees only own classes; a school admin sees classes of own school via the BE-21 endpoints, not these; out-of-scope ids return 404.
3. Teacher dashboard counters equal counts computed from the tables (no stored aggregates); verified against seeded data.
4. Enrolment respects school boundary (student and class in the same school) unless the mock allows cross-school (note the rule in the PR).
5. `ClassesRepository` exposes the methods other modules need (`forTeacher`, `forStudent`, `roster`, `schoolClasses`) with unit tests.
6. All responses parse with the contract schemas.

## Test commands

```
npm run be:test -- apps/api/test/classes
npm run be:verify
```

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-17 (classes-teacher). Work in this repo clone on branch be/BE-17-classes-teacher, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10); docs/plan/backend-tasks/BE-17-classes-teacher.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs.
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-17 from the M10 SRS and the m10 mock handlers listed in the card. Expose ClassesRepository as the only doorway to classrooms/enrolments. Scope-filter every query with ScopeFilter. Do not implement missions, remedial, question sets, DSKP posts or the Command Center.
```
