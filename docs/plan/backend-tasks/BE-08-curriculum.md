# BE-08 Curriculum (M03): levels, subjects, chapters, topics, DSKP tree

| Field | Value |
|---|---|
| Size | M |
| Wave | 1 |
| Depends on | BE-03 |
| Parallel with | BE-04, BE-05, BE-11, BE-14 |
| Owner module | M03 |

## Goal

Own the curriculum store: education levels, subjects, subject-levels (derived), chapters (with `strand` and `dskpCode`), topics, subtopics, and the DSKP `curriculum_node` tree used to tag questions (v2 exam schema D9). Serve the learner and admin endpoints of M03.

## Inputs (read these)

- `docs/requirements/srs/M03-curriculum.md`, `docs/requirements/urs/M03-curriculum.md`
- Mock: `src/modules/m03-curriculum/mock/handlers/{lookups,student-curriculum,admin-common,admin-curriculum,admin-levels,admin-subjects}.ts`, tables `curriculum.*` in `src/modules/m03-curriculum/mock/tables`, seeds in `.../mock/seeds`; client `src/modules/m03-curriculum/api/*`
- `docs/requirements/v2-exam-schema.md` D9 (curriculum tagging model, `curriculum_node` with kinds grouping/unit/sk/sp, TP descriptors, BM aliases) and section 6
- `docs/reference/dskp/*.json` (13 subjects, Tingkatan 4 and 5)
- `docs/architecture/v2-data-migration.md` section 4.2 (M03 realign: `strand`, `dskpCode`, `inTree` rule, derived subject-levels)

## Outputs

- Contract: `packages/contract/src/curriculum/**`
- `apps/api/prisma/schema/curriculum.prisma` + migration: `education_levels`, `subjects`, `subject_levels`, `chapters`, `topics`, `subtopics`, `curriculum_nodes`
- `apps/api/src/modules/curriculum/**`; repository methods other cards use: `subjects()`, `levels()`, `chapters(subjectId, levelId)`, `node(code)`, `topicProgress(userId)` is **not** here (derived in BE-13 from the answer log, BR-19)
- Seed: `apps/api/prisma/seed/curriculum.ts` loading the observed curriculum seeds of the mock and the DSKP JSON nodes
- Tests under `apps/api/test/curriculum/**`

## Endpoints (paths from the mock)

| Method and path | Notes |
|---|---|
| `GET /api/education-levels`, `GET /api/subjects`, `GET /api/topics`, `GET /api/learning-map` | learner/lookup reads (auth required as in the mock) |
| `GET /api/admin/education-levels`, `GET /api/admin/subjects`, `GET /api/admin/curriculum` | admin lists (`admin` only) |
| `POST /api/admin/education-levels`, `POST /api/admin/subjects`, `POST /api/admin/curriculum/chapters`, `POST /api/admin/curriculum/topics`, `POST /api/admin/curriculum/subtopics` | create with the mock's validation and BM messages |
| `GET /api/topics/:id` | topic detail |

Teacher DSKP routes (`/api/guru/dskp/*`): the GET lookups are in BE-10, the POSTs in BE-18.

## DB tables touched

`education_levels`, `subjects`, `subject_levels`, `chapters`, `topics`, `subtopics`, `curriculum_nodes`.

## Acceptance criteria

1. Each endpoint returns the mock's shape for the seeded data; the seeded subject/level/chapter counts equal the mock seed counts (assert in a test against exported JSON counts, not hard-coded guesses).
2. Duplicate and validation rules match the mock (unique names per scope, required fields) with the same error codes.
3. `subject_levels` is derived by a rule (no .cloud source), covered by a unit test.
4. `curriculum_nodes` loads all 13 DSKP JSON files without error and supports lookup by code and parent traversal; Tingkatan 1 to 3 Matematik content is **not** invented (OQ Q-S2: tag as `form_origin` only when the question bank needs it).
5. Role checks: non-admin cannot POST/admin GET (403).

## Test commands

```
npm run be:db:seed
npm run be:test -- apps/api/test/curriculum
npm run be:verify
```

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-08 (curriculum). Work in this repo clone on branch be/BE-08-curriculum, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10); docs/plan/backend-tasks/BE-08-curriculum.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs.
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-08. Derive the contract from the m03 mock handlers and api types, add strand/dskpCode and the derived subject-levels rule from docs/architecture/v2-data-migration.md section 4.2, add the curriculum_node tree from docs/reference/dskp/*.json (v2-exam-schema D9), and load the mock's curriculum seeds. Do not compute topic progress here.
```
