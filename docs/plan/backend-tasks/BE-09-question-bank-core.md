# BE-09 Question bank core (M04): schema, repository, question CRUD and eligibility

| Field | Value |
|---|---|
| Size | L |
| Lane | PC-2 (folders: sessions.md section 5) |
| Priority | P0 |
| Wave | 2 |
| Depends on | BE-08 |
| Parallel with | BE-11, BE-14, BE-17 (after BE-05/BE-08) |
| Owner module | M04 (single owner of questions, ADR-0014) |

## Goal

Create the v2 question store as approved in `docs/requirements/v2-exam-schema.md` (D47): question = ordered tree of parts, leaf answer modes, five answer-key kinds, structured mark-scheme points, stimuli and stimulus groups, curriculum tags, lifecycle. Provide the owner repository that M05 (practice) and M28 (Bijak) call, and the question list/detail/CRUD endpoints the Guru and Admin screens use today.

## Inputs (read these)

- `docs/requirements/v2-exam-schema.md` (all of sections 0 to 7, especially D1 to D12 and the entity table in section 6) and `docs/requirements/v2-question-bank.md` (lifecycle section 4.1, user stories, ACs)
- `docs/requirements/srs/M04-question-bank.md`, `docs/requirements/urs/M04-question-bank.md`
- Mock: `src/modules/m04-question-bank/mock/handlers/{questions,question-input,question-shape,workflow-common,dskp,dskp-source}.ts`, repository `src/modules/m04-question-bank/mock/repository/*`; client/types `src/modules/m04-question-bank/api/*`
- `src/modules/m28-bijak-spm/domain/types.ts` (`QuestionDef`, `PartDef`, `SchemeDef`, `PointDef`: the UI's current view of the same schema)
- `docs/adr/0014-store-ownership-and-repositories.md` (the M04 contract: `questions.get/getMany/count/groupCount`, `eligibleForPractice`, `sample`, `gradeAnswer`, `deactivate`)
- `docs/architecture/v2-data-migration.md` section 4.3 and section 3 (.cloud bank is NOT migrated)

## Outputs

- Contract: `packages/contract/src/questions/**` (question, part, option, answer key kinds, mark-point, stimulus, tag, list filters, errors)
- `apps/api/prisma/schema/questions.prisma` + migration: `stimuli`, `stimulus_groups`, `questions`, `question_versions`, `question_parts`, `part_options`, `answer_keys` (jsonb content validated by zod per kind), `question_tags`
- `apps/api/src/modules/questions/**`: `QuestionsRepository` (the only doorway), `QuestionsService`, controller, `gradeAnswer` for MCQ/short answers (pure functions; the subjective marking engine is `@pp/exam-core`, BE-14)
- Seed: `apps/api/prisma/seed/questions.ts`: a small fictitious but structurally valid bank (objective MCQ for 3 subjects x 2 forms, a few structured questions with K/N/P points and one stimulus group); never copy real exam content or the .cloud bank
- Tests under `apps/api/test/questions/**`

## Endpoints (paths from the mock; reads for Guru/Admin, creates for Guru)

| Method and path | Notes |
|---|---|
| `GET /api/questions`, `GET /api/questions/summary`, `GET /api/questions/:id` | filters from the mock (subject, level, chapter, status, type, search); role-scoped visibility (Guru: own uploads and published; Admin: all) |
| `POST /api/questions`, `PUT /api/questions/:id`, `DELETE /api/questions/:id`, `POST /api/questions/bulk-action` | create/edit with the lifecycle rules of BE-10; **only Admin Pusat approves and publishes** (D40a) |
| `GET /api/structured-questions` | structured list |
| `GET /api/guru/questions`, `POST /api/guru/questions` | Guru contribution endpoints (move to this card from the M10 list, owner M04) |

The status workflow, reports, submissions, imports, quality audit and AI explanation are **BE-10**.

## DB tables touched

`stimuli`, `stimulus_groups`, `questions`, `question_versions`, `question_parts`, `part_options`, `answer_keys`, `question_tags`, `curriculum_nodes` (read).

## Acceptance criteria

1. A question with 1 part (MCQ) and a question with a 3-level part tree ((a)(i)(A)) both round-trip through create and read; only leaf parts carry marks and an answer mode (validation rejects marks on a branch part).
2. The eight leaf modes and five key kinds of D1/D3 validate with zod discriminated unions in the contract; an invalid combination (e.g. `mcq` with `rubric` key) returns 422.
3. Mark points support code letters, marks, accepted equivalents, "any N of M" groups, alternative methods, ECF and tolerance as in D4.2 (validation tests for each; no marking logic here).
4. A stimulus group keeps its ordered questions together; reading any member returns the stimulus once.
5. A question cannot reach `published` without subject, level, unit, SP and TP tags (D9 rule), enforced in service and tested.
6. Repository contract for other modules exists and is covered: `get`, `getMany`, `count`, `groupCount`, `eligibleForPractice`, `sample` (seeded PRNG), `gradeAnswer`, `deactivate`.
7. List responses match the mock shape (`meta.counts` etc.) for the seeded data; Guru cannot see another teacher's drafts.
8. Source PDFs/answer keys of unpublished or exam-mode items are never returned to a student role (404 for students on non-published ids).

## Test commands

```
npm run be:db:seed
npm run be:test -- apps/api/test/questions
npm run be:verify
```

## Migration-first (plan section 14)

- Every new table that could receive .cloud rows carries `legacy_source`, `legacy_id` and `unique (legacy_source, legacy_id)`, and is added to `apps/api/prisma/migratable-models.json`. Not in the contract.
- Enums are `text` + `check` (English codes); anything the source may lack is nullable or has a documented default.
- Add or update this entity's row in the mapping matrix (plan section 14.7) in the same PR; seeds must not set `legacy_*` and must be idempotent.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-09 (question-bank-core). Work in this repo clone on branch be/BE-09-question-bank-core, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-09-question-bank-core.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-09. The data model is the approved docs/requirements/v2-exam-schema.md (D1-D12): do not redesign it. Mirror the frontend's current types in src/modules/m28-bijak-spm/domain/types.ts and the m04 mock handlers for the wire shapes. Build the QuestionsRepository as the only doorway (ADR-0014) with eligibleForPractice, sample and gradeAnswer for objective items. Seed only invented, structurally valid questions. Do not migrate or copy the .cloud bank.
```
