# BE-08 Curriculum (M03): levels, subjects, chapters, topics, DSKP tree

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-2 (folders: sessions.md section 5) |
| Priority | P0 |
| Wave | 1 |
| Depends on | BE-03 |
| Parallel with | BE-04, BE-05, BE-11, BE-14 |
| Owner module | M03 |

## Goal

Own the curriculum store: education levels, subjects, subject-levels (derived), chapters (with `strand` and `dskpCode`), topics, subtopics, and the DSKP `curriculum_node` tree used to tag questions (v2 exam schema D9). Serve the learner and admin endpoints of M03.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/requirements/srs/M03-curriculum.md` (BR-01 to BR-19, section 7 route table, section 8 messages), `docs/requirements/urs/M03-curriculum.md`
- Mock handlers: `src/modules/m03-curriculum/mock/handlers/{lookups,student-curriculum,admin-common,admin-curriculum,admin-levels,admin-subjects}.ts`; mock stores and rules: `src/modules/m03-curriculum/mock/repository/{stores,curriculum,rules,progress,queries,types}.ts`; seeds: `src/modules/m03-curriculum/mock/seeds/curriculum.ts`; client `src/modules/m03-curriculum/api/*`
- Mock tests to port: `src/modules/m03-curriculum/__tests__/mock/{admin-handlers,curriculum-store,student-handlers}.test.ts`
- `docs/requirements/v2-exam-schema.md` D9 (curriculum tagging model, `curriculum_node` with kinds grouping/unit/sk/sp, TP descriptors, BM aliases) and section 6
- `docs/reference/dskp/*.json` (13 subject files) and `docs/reference/dskp/README.md`
- `docs/architecture/v2-data-migration.md` section 4.2 (M03 realign: `strand`, `dskpCode`, `inTree` rule, derived subject-levels)
- BE-03 outputs (guards, `ScopeFilter`)
- Requirements: BE-FR-08 ([URS 9.2](../../requirements/v2-backend-urs.md))
- API catalogue part B1 (core, identity, curriculum): [core-identity-curriculum.md](../../architecture/v2-api-catalogue/core-identity-curriculum.md) (endpoint list, wire conventions and open questions for this card's scope)
- Data model: [v2-data-model.md](../../architecture/v2-data-model.md) (tables, keys and indexes of this card; being written 2026-10-19)

## Outputs

- Contract: `packages/contract/src/curriculum/**`
- `apps/api/prisma/schema/curriculum.prisma` + migration: `education_levels`, `subjects`, `subject_levels`, `chapters`, `topics`, `subtopics`, `curriculum_nodes`
- `apps/api/src/modules/curriculum/**`; repository methods other cards use: `subjects()`, `levels()`, `chapters(subjectId, levelId)`, `node(code)`. `topicProgress(userId)` is **not** here (derived in BE-13 from the answer log, BR-19)
- Seed `apps/api/prisma/seed/curriculum.ts`, reading JSON snapshots under `apps/api/prisma/seed/curriculum-data/` (the mock seeds exported once, by a throw-away script, to JSON; the seed never imports from `src/**`) and `docs/reference/dskp/*.json` for the DSKP nodes
- Tests under `apps/api/test/curriculum/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/curriculum/**`.
- Prisma file(s): `apps/api/prisma/schema/curriculum.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/curriculum/**` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: `apps/api/prisma/seed/curriculum.ts`, `apps/api/prisma/seed/curriculum-data/**`, plus one line in `apps/api/prisma/seed/index.ts`.
- Tests: `apps/api/test/curriculum/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/curriculum/`.
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: curriculum.prisma belongs to this card alone. It can run in parallel with BE-11 (wallet.prisma) and BE-04/BE-05 (PC-1).

## Endpoints (all 29 mock routes of M03, paths from the mock)

Every route below exists in the mock handlers (verified). Learner reads need a session; every `/api/admin/*` route is `admin` only.

| Group | Endpoints |
|---|---|
| Lookups and learner reads | `GET /api/education-levels`, `GET /api/subjects` (active records only, BR-08 order), `GET /api/topics`, `GET /api/topics/:id`, `GET /api/learning-map` |
| Admin education levels | `GET /api/admin/education-levels`, `GET /api/admin/education-levels/:id`, `POST /api/admin/education-levels`, `PUT /api/admin/education-levels/:id`, `PATCH /api/admin/education-levels/:id/active`, `DELETE /api/admin/education-levels/:id` |
| Admin subjects | `GET /api/admin/subjects`, `GET /api/admin/subjects/:id`, `POST /api/admin/subjects`, `PUT /api/admin/subjects/:id`, `PATCH /api/admin/subjects/:id/active`, `DELETE /api/admin/subjects/:id` |
| Admin curriculum tree | `GET /api/admin/curriculum`, `GET /api/admin/curriculum/chapters/:id`, `POST /api/admin/curriculum/chapters`, `PUT /api/admin/curriculum/chapters/:id`, `DELETE /api/admin/curriculum/chapters/:id`, `GET /api/admin/curriculum/topics/:id`, `POST /api/admin/curriculum/topics`, `PUT /api/admin/curriculum/topics/:id`, `DELETE /api/admin/curriculum/topics/:id`, `POST /api/admin/curriculum/subtopics`, `PUT /api/admin/curriculum/subtopics/:id`, `DELETE /api/admin/curriculum/subtopics/:id` |

Teacher DSKP routes (`/api/guru/dskp/*`): the GETs are in BE-10, the POSTs in BE-18. `GET/POST /api/guru/{chapters,topics}` (teacher helpers) are in BE-17 and delegate to this card's repository.

## DB tables touched

`education_levels`, `subjects`, `subject_levels`, `chapters`, `topics`, `subtopics`, `curriculum_nodes`.

## Acceptance criteria

1. Each endpoint returns the mock's shape for the seeded data and parses with its contract schema. Proof: port the three mock test files listed in Inputs to supertest (status, `error.code`, exact message, body).
2. Seed counts: 11 education levels (SRS BR-01) and the chapter tree as the mock seeds it (SRS v1.10: 1,251 in-tree chapters plus 60 records with `inTree = false`); the test asserts equality with the counts in the JSON snapshots and with these two SRS figures, so a drifting snapshot fails.
3. Exact messages (mock `admin-common.ts`): not found "Bab tidak dijumpai.", "Topik tidak dijumpai.", "Subtopik tidak dijumpai.", "Subjek tidak dijumpai.", "Tahap Pendidikan tidak dijumpai."; missing chapter id "Chapter ID diperlukan."; success flashes "Bab berjaya ditambah." / "Bab berjaya dikemaskini." / "Bab berjaya dipadam." and the same three for Topik, Subtopik, Subjek, Tahap Pendidikan. Validation failures are 422 `VALIDATION_ERROR` with the mock's `fields` keys and Laravel-style copy (for example "The selected :attribute is invalid.").
4. Cascades (SRS BR-10): deleting a chapter deletes its topics and subtopics; deleting a topic deletes its subtopics; deleting a subject or level removes its subject-level links and its curriculum chapters. A test counts rows before and after.
5. `subject_levels` is derived by a rule (no .cloud source), covered by a unit test, and `GET /api/subjects` shows only active records in BR-08 order.
6. `curriculum_nodes` loads all 13 DSKP JSON files without error and supports lookup by code and parent traversal. Tingkatan 1 to 3 Matematik content is **not** invented (Q-S2): such nodes are tagged `form_origin` only when the question bank needs it.
7. `GET /api/topics?gradeLevel=&subject=` is case-insensitive, combines filters with AND, orders by `sequence` then id and returns nothing for an unknown code (SRS FR-M03-72); `GET /api/topics/:id` for an unknown id is 404 "Topik tidak dijumpai.".
8. Topic progress: `GET /api/learning-map` and `GET /api/topics` carry per-user progress fields (SRS BR-14 island states, BR-19 progress). This card reads them through a provider interface `TopicProgressProvider.topicProgress(userId)` that BE-13 implements from the answer log; until BE-13 merges the default provider returns "no progress", which gives the mock's initial state (first two topics open, SRS BR-14), and a test covers that default.
9. Roles: every `/api/admin/*` route gives 403 to non-admin; the learner reads give 401 without a session; a mutating call without CSRF gives 403 `CSRF_INVALID`.

## Test commands

```
npm run be:db:seed
npm run be:test -- apps/api/test/curriculum
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/curriculum/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
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

1. `strand` and `dskpCode` on chapters, the `inTree` rule and the derived subject-levels come from `v2-data-migration.md` 4.2; if the mock seed has no value for them, leave null and list the gap in the PR.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-08 (curriculum). Work in this repo clone on branch be/BE-08-curriculum, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-08-curriculum.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-08. Derive the contract from the m03 mock handlers and api types, add strand/dskpCode and the derived subject-levels rule from docs/architecture/v2-data-migration.md section 4.2, add the curriculum_node tree from docs/reference/dskp/*.json (v2-exam-schema D9), and load the mock's curriculum seeds. Do not compute topic progress here.
```
