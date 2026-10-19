# BE-18 Teacher missions, remedial tests, question sets and DSKP picks (M10 part B)

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-6 (folders: sessions.md section 5) |
| Priority | P1 |
| Wave | 3 |
| Depends on | BE-17, BE-09, BE-12 |
| Parallel with | BE-16, BE-19, BE-23 |
| Owner module | M10 |

## Goal

Teacher-assigned work and its student side: class missions, remedial test generation from weak topics (scan, generate, cancel), teacher question sets / question papers, and the teacher DSKP bidang/SK/SP picks. These feed M05 `assigned.ts` modes (mission, remedial, question set) already supported by BE-12.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/requirements/srs/M10-teacher-class.md` (FR-M10-52 to FR-M10-58 missions, FR-M10-98 question papers, BR-M10-17 recipients, BR-M10-18 sets, remedial sections), `docs/requirements/srs/M05-practice.md` (assigned modes)
- Mock: `src/modules/m10-teacher-class/mock/handlers/{command-center,command-center-remedial,questions,extras,csv,docx,lookups,student-side,dashboard}.ts`, repository `src/modules/m10-teacher-class/mock/repository/{missions,question-sets,remedial,dskp}.ts`, tables `src/modules/m10-teacher-class/mock/tables/tables.ts`: `m10.missions`, `m10.remedialTests`, `m10.questionSets`, `m10.dskpBidang`, `m10.dskpSk`, `m10.dskpSp`; M05 `src/modules/m05-practice/mock/handlers/assigned.ts` (the three assigned-work reads); client `src/modules/m10-teacher-class/api/*`, `src/modules/m10-teacher-class/api/command-center.ts`
- Mock tests: `src/modules/m10-teacher-class/__tests__/mock/**`, `src/modules/m05-practice/__tests__/mock/structured-targets-assigned.test.ts`
- BE-17, BE-12 outputs, BE-10 DSKP GET endpoints, BE-09 `QuestionsService`

## Outputs

- Contract: `packages/contract/src/classes/missions.ts` and `packages/contract/src/classes/question-sets.ts` (new files in the PC-6 `classes/` folder)
- `apps/api/prisma/schema/classes.prisma` additions + migration: `missions`, `mission_items`, `remedial_tests`, `question_sets`, `question_set_items`, `dskp_bidang`, `dskp_sk`, `dskp_sp`
- `apps/api/src/modules/missions/**` (missions, remedial tests, question sets, DSKP picks) exporting `MissionsService.forStudent(userId, today)` and `RemedialTestsService.forStudent(userId)` that BE-12 consumes
- Tests under `apps/api/test/missions/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/missions/**`.
- Prisma file(s): `apps/api/prisma/schema/classes.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/classes/missions.ts`, `packages/contract/src/classes/question-sets.ts` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: none.
- Tests: `apps/api/test/missions/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/missions/`.
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: classes.prisma was last changed by BE-17 (BE-18 depends on it). It does not touch practice.prisma; it reads practice data through `PracticeRepository`.

## Endpoints (paths from the mock; the Command Center base is `/api/guru/command-center`)

Every route below exists in the mock (verified) except the two marked provisional.

| Method and path | Notes |
|---|---|
| `POST /api/guru/question-papers`, `GET /api/set-soalan-saya` | teacher question paper submission (multipart; creates an M04 submission `pending`, SRS FR-M10-98); student list of sets shared with them |
| `POST /api/guru/dskp/bidang`, `POST /api/guru/dskp/sk`, `POST /api/guru/dskp/sp` | teacher DSKP picks (the GETs are BE-10) |
| `GET /api/guru/remedial-progress` | remedial progress per class |
| `GET /api/guru/command-center/remedial/scan`, `POST /api/guru/command-center/remedial/generate`, `POST /api/guru/command-center/remedial/cancel` | weak-topic scan, generation, cancel |
| `GET /api/guru/audio-kbat/template`, `GET /api/guru/audio-kbat/template-word` | template downloads (XLSX / DOCX) used by the teacher screens |
| `GET /api/missions/today`, `GET /api/remedial-tests/mine`, `GET /api/remedial-tests/:id` | student reads moved here from BE-13 (the mock reads M10 records through seams; mock file `m05-practice/mock/handlers/assigned.ts`) |
| `GET /api/guru/missions`, `POST /api/guru/missions` (**provisional**) | SRS FR-M10-52 and FR-M10-58 define them but the mock registers no route; build only after the lead confirms the contract (Open question 1) |

## DB tables touched

`missions`, `mission_items`, `remedial_tests`, `question_sets`, `question_set_items`, `dskp_*`, `practice_sessions` (read, to mark mission completion), `classrooms` (via BE-17 repository), `questions` (via BE-09 repository).

## Acceptance criteria

1. Missions (only if Open question 1 is answered yes): a teacher launches a mission for an own class only; recipients are the class's students at launch time and are stored (`recipientIds`, SRS BR-M10-17); a student outside the class cannot start it (`POST /api/practice/sessions` with `missionId` returns the mock's 404). `GET /api/missions/today` is built regardless and returns the mock shape for seeded missions.
2. Remedial: scan, generate and cancel keep the mock's status codes and messages (replay the cases of the mock tests); generation picks weak topics from the answer-row dimensions through `PracticeRepository` (BE-12/13), is deterministic with the seeded PRNG, and cancel is idempotent (a second cancel returns the same status). `GET /api/remedial-tests/mine` returns only `active` and `completed` tests, newest first (mock BR-32), with `teacherName` and `totalQuestions`.
3. Question set items reference questions through `QuestionsService`; a deactivated question is skipped when the set is served, not deleted from the set. `GET /api/set-soalan-saya` returns the sets visible to the user (draft never; scheduled once due) with `attemptsLeft` = `maxAttempts` minus the user's completed `question_set` sessions, floored at 0, and `null` when attempts are unlimited (`maxAttempts` 0) (mock BR-M10-18).
4. Migrated question sets keep headers only (Q4 default): such a set returns the mock's empty-set state; the exact field is Open question 2.
5. Template downloads (`audio-kbat`) send the right `Content-Type` (XLSX or DOCX), `Content-Disposition: attachment` and a fixed header row copied from the mock; any generated CSV neutralises cells starting with `=`, `+`, `-`, `@`.
6. `POST /api/guru/question-papers` accepts only the file types and size the mock accepts (read `extras.ts`), stores through BE-04 and creates a `pending` submission via BE-10's service (until BE-10 merges the PR says so).
7. Roles: teacher routes need role `teacher`; the student reads need a session; other roles get 403; teachers act only on own classes and own records (404 otherwise); missing CSRF 403 `CSRF_INVALID`.

## Test commands

```
npm run be:test -- apps/api/test/missions
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/missions/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
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

1. `POST /api/guru/missions` and `GET /api/guru/missions` are in the SRS (provisional) but not in the mock. Build them or not? Working assumption: not until confirmed; missions come from the seed.
2. Which field shows the empty "perlu dibina semula" state of a migrated set? Confirm in `srs/M10-teacher-class.md` before coding.
3. The M10 inline-create error shape (`200 { error }`) question of BE-17 applies to the DSKP POSTs here too.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-18 (missions-remedial-sets). Work in this repo clone on branch be/BE-18-missions-remedial-sets, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-18-missions-remedial-sets.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-18. The Command Center base path is /api/guru/command-center (mock command-center.ts). Move GET /api/missions/today, GET /api/remedial-tests/mine and GET /api/remedial-tests/:id here from BE-13. Missions create/list routes are provisional: ask before building them. Reuse the BE-17 ClassesRepository, the BE-09 QuestionsRepository and the BE-12 PracticeRepository; never read their tables directly. Teachers act only on own classes.
```
