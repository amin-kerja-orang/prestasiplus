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

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/requirements/v2-exam-schema.md` (sections 0 to 7, especially D1 to D12 and the entity table in section 6) and `docs/requirements/v2-question-bank.md` (lifecycle 4.1, user stories, ACs)
- `docs/requirements/srs/M04-question-bank.md`, `docs/requirements/urs/M04-question-bank.md`
- Mock: `src/modules/m04-question-bank/mock/handlers/{questions,question-input,question-shape,workflow-common,dskp,dskp-source,structured}.ts`, `src/modules/m10-teacher-class/mock/handlers/questions.ts` (the Guru question routes), repository `src/modules/m04-question-bank/mock/repository/*`; client and types `src/modules/m04-question-bank/api/*`
- Mock tests to port: `src/modules/m04-question-bank/__tests__/mock/**`
- `src/modules/m28-bijak-spm/domain/types.ts` (`QuestionDef`, `PartDef`, `SchemeDef`, `PointDef`: the UI's current view of the same schema)
- `docs/adr/0014-store-ownership-and-repositories.md` (the M04 contract: `questions.get/getMany/count/groupCount`, `eligibleForPractice`, `sample`, `gradeAnswer`, `deactivate`)
- `docs/architecture/v2-data-migration.md` section 4.3 and section 3 (.cloud bank is NOT migrated)
- BE-08 outputs (curriculum repository)

## Outputs

- Contract: `packages/contract/src/questions/**` (question, part, option, answer key kinds, mark-point, stimulus, tag, list filters, errors)
- `apps/api/prisma/schema/questions.prisma` + migration: `stimuli`, `stimulus_groups`, `questions`, `question_versions`, `question_parts`, `part_options`, `answer_keys` (jsonb content validated by zod per kind), `question_tags`. Status is `text` + `check` with the codes `draft`, `review`, `approved`, `published`, `archived` (BM labels Draf, Semakan, Lulus, Terbit, Diarkib stay in the UI, X2).
- `apps/api/src/modules/questions/**` (not `questions/workflow/**`, which is BE-10): `QuestionsRepository` (the only doorway), `QuestionsService`, controller, `gradeAnswer` for MCQ/short answers (pure functions; the subjective marking engine is `@pp/exam-core`, BE-14). The service also exports `setStatus(id, status, actorId)` and `getStatus`, which BE-10 uses for the lifecycle; this card enforces the publish tag rule inside `setStatus`, BE-10 owns the transition table and events.
- Seed `apps/api/prisma/seed/questions.ts`: a small fictitious but structurally valid bank (objective MCQ for 3 subjects x 2 forms, a few structured questions with K/N/P points and one stimulus group); never copy real exam content or the .cloud bank
- Tests under `apps/api/test/questions/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/questions/**`.
- Prisma file(s): `apps/api/prisma/schema/questions.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/questions/**` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: `apps/api/prisma/seed/questions.ts`, plus one line in `apps/api/prisma/seed/index.ts`.
- Tests: `apps/api/test/questions/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/questions/`.
- Do not touch: `apps/api/src/modules/questions/workflow/**` (BE-10, lane PC-5).
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: questions.prisma belongs to this card (and BE-10/BE-38 only use the service). Do not edit `modules/questions/workflow/**`; that folder is lane PC-5.

## Endpoints (paths from the mock; reads for Guru/Admin, creates for Guru)

Every route below exists in the mock (verified).

| Method and path | Notes |
|---|---|
| `GET /api/questions`, `GET /api/questions/summary`, `GET /api/questions/:id` | filters from the mock (subject, level, chapter, status, type, search); role-scoped visibility (Guru: own uploads and published; Admin: all) |
| `POST /api/questions`, `PUT /api/questions/:id`, `DELETE /api/questions/:id`, `POST /api/questions/bulk-action` | create/edit/delete/bulk; status changes go through BE-10's transition table; **only Admin Pusat approves and publishes** (D40a) |
| `GET /api/structured-questions`, `GET /api/structured-questions/:id` | structured list and detail |
| `GET /api/guru/questions`, `GET /api/guru/questions/:id`, `POST /api/guru/questions`, `PUT /api/guru/questions/:id`, `DELETE /api/guru/questions/:id` | Guru contribution routes (the mock keeps them in M10 `questions.ts`; owner is M04, so they live in this module); `GET /api/guru/contributions` stays in BE-17 and calls this module |

The status workflow, reports, submissions, imports, quality audit, diagram audit, master notes, DSKP lookups and the AI explanation stub are **BE-10**.

## DB tables touched

`stimuli`, `stimulus_groups`, `questions`, `question_versions`, `question_parts`, `part_options`, `answer_keys`, `question_tags`, `curriculum_nodes` (read).

## Acceptance criteria

1. A question with 1 part (MCQ) and a question with a 3-level part tree ((a)(i)(A)) both round-trip through create and read; only leaf parts carry marks and an answer mode (validation rejects marks on a branch part with 422 `VALIDATION_ERROR`).
2. The eight leaf modes and five key kinds of D1/D3 validate with zod discriminated unions in the contract; an invalid combination (for example `mcq` with a `rubric` key) returns 422 `VALIDATION_ERROR` with the offending field in `fields`.
3. Mark points support code letters, marks, accepted equivalents, "any N of M" groups, alternative methods, ECF and tolerance as in D4.2: one validation test per feature; no marking logic here.
4. A stimulus group keeps its ordered questions together; reading any member returns the stimulus once (test with three members).
5. `setStatus(..., 'published')` fails with 422 unless subject, level, unit, SP and TP tags are set (D9 rule); the same rule is applied when `POST /api/questions` is called with a published status. Tested in the service and through the endpoint.
6. The repository contract for other modules exists and each method has a test: `get`, `getMany`, `count`, `groupCount`, `eligibleForPractice` (status `published` and active only), `sample` (seeded PRNG, same seed gives the same ids), `gradeAnswer`, `deactivate` (the question leaves `eligibleForPractice` immediately).
7. List responses match the mock shape (`meta.counts`, pagination) for the seeded data; a Guru cannot see another teacher's drafts (404 on `:id`, absent from the list).
8. A student session gets 404 on every non-published question id and never receives the source PDF, answer key or mark scheme of an unpublished or exam-mode item.
9. Mock-parity replay: the cases in `src/modules/m04-question-bank/__tests__/mock/**` that concern the routes above give the same status and error code on the API (differences caused by the v2 schema are listed in the PR and in `v2-backend-deviations.md`).
10. Roles: Admin Pusat full access; Guru only the `/api/guru/questions*` routes and own rows; Murid and Admin Sekolah get 403 on the admin routes; no session 401; missing CSRF 403 `CSRF_INVALID`.

## Test commands

```
npm run be:db:seed
npm run be:test -- apps/api/test/questions
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/questions/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
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

1. The mock wire shape (SRS BR-M04-01) uses statuses `draft`, `pending_review`, `approved`, `rejected`, `archived` and the old two-type model (`mcq`, `structured`), while v2 (v2-question-bank 4.1, exam schema D1/D12) has Draf, Semakan, Lulus, Terbit, Diarkib and the part tree. The frontend consumes the contract, so the contract PR (label `contract`) must say which shape the wire uses and how the old values map (for example `pending_review` to `review`, `approved` to `published`). Working assumption: v2 codes on the wire, mapping table in the contract PR; the lead decides.
2. `setStatus` is the interface BE-10 needs from this card; confirm the signature with PC-5 in the contract/cross-lane issue if BE-10 starts first.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-09 (question-bank-core). Work in this repo clone on branch be/BE-09-question-bank-core, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-09-question-bank-core.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-09. The data model is the approved docs/requirements/v2-exam-schema.md (D1-D12): do not redesign it. Mirror the frontend's current types in src/modules/m28-bijak-spm/domain/types.ts and the m04 mock handlers for the wire shapes. Build the QuestionsRepository as the only doorway (ADR-0014) with eligibleForPractice, sample and gradeAnswer for objective items. Seed only invented, structurally valid questions. Do not migrate or copy the .cloud bank.
```
