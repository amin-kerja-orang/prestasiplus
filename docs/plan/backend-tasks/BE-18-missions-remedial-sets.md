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

- `docs/requirements/srs/M10-teacher-class.md`, `docs/requirements/srs/M05-practice.md` (assigned modes)
- Mock: `src/modules/m10-teacher-class/mock/handlers/{command-center-remedial,questions,extras,csv,docx,lookups}.ts` (remedial scan/generate/cancel under the Command Center base), tables `m10.missions`, `m10.remedialTests`, `m10.questionSets`, `m10.dskpBidang`, `m10.dskpSk`, `m10.dskpSp`; M05 `mock/handlers/assigned.ts`; client `src/modules/m10-teacher-class/api/*`
- BE-17, BE-12 outputs, BE-10 DSKP GET endpoints

## Outputs

- Contract: `packages/contract/src/teacher-work/**`
- `apps/api/prisma/schema/classes.prisma` additions + migration: `missions`, `mission_items`, `remedial_tests`, `question_sets`, `question_set_items`, `dskp_bidang`, `dskp_sk`, `dskp_sp`
- `apps/api/src/modules/teacher-work/**`
- Tests under `apps/api/test/teacher-work/**`

## Endpoints (paths from the mock)

| Method and path | Notes |
|---|---|
| `POST /api/guru/question-papers`, `GET /api/set-soalan-saya` | teacher question set creation; student list of sets shared with them |
| `POST /api/guru/dskp/bidang`, `POST /api/guru/dskp/sk`, `POST /api/guru/dskp/sp` | teacher DSKP picks |
| `GET /api/guru/remedial-progress` | remedial progress per class |
| `GET <command-center base>/remedial/scan`, `POST <command-center base>/remedial/generate`, `POST <command-center base>/remedial/cancel` | confirm the real base path in `command-center-remedial.ts` and `command-center.ts` (the card cannot guess it) |
| `GET /api/guru/audio-kbat/template`, `GET /api/guru/audio-kbat/template-word` | template downloads (CSV/Word) used by the teacher screens |
| `GET /api/missions/today`, `GET /api/remedial-tests/mine` | already read in BE-13; this card creates the data they read |

## DB tables touched

`missions`, `mission_items`, `remedial_tests`, `question_sets`, `question_set_items`, `dskp_*`, `practice_sessions` (read, to mark mission completion), `classrooms` (via BE-17 repository), `questions` (via BE-09 repository).

## Acceptance criteria

1. A teacher can assign a mission to own class only; students outside the class cannot start it (`POST /practice/sessions` with `missionId` returns 403/404 as the mock does).
2. Remedial generation picks weak topics from the answer-row dimensions (BE-12/13), is deterministic with the seeded PRNG, and cancel is idempotent.
3. Question set items reference questions through the repository; a deactivated question is skipped at serve time, not deleted from the set.
4. Migrated question sets keep headers only (Q4 default): an empty set shows the mock state "perlu dibina semula" fields (confirm field in the SRS).
5. Document/CSV templates download with correct headers, `Content-Disposition`, and no formula injection (cells starting with `=`, `+`, `-`, `@` are neutralised).
6. All routes enforce teacher role and ownership; others get 403/404.

## Test commands

```
npm run be:test -- apps/api/test/teacher-work
npm run be:verify
```

## Migration-first (plan section 14)

- Every new table that could receive .cloud rows carries `legacy_source`, `legacy_id` and `unique (legacy_source, legacy_id)`, and is added to `apps/api/prisma/migratable-models.json`. Not in the contract.
- Enums are `text` + `check` (English codes); anything the source may lack is nullable or has a documented default.
- Add or update this entity's row in the mapping matrix (plan section 14.7) in the same PR; seeds must not set `legacy_*` and must be idempotent.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-18 (missions-remedial-sets). Work in this repo clone on branch be/BE-18-missions-remedial-sets, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-18-missions-remedial-sets.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-18. Find the exact Command Center base path used by remedial scan/generate/cancel in src/modules/m10-teacher-class/mock/handlers before writing the contract. Reuse the BE-17 ClassesRepository, the BE-09 QuestionsRepository and the BE-12 PracticeRepository; never read their tables directly. Teachers act only on own classes.
```
