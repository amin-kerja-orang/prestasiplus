# BE-13 Practice read models: dashboard, subjects, mastery, revision, targets

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-2 (folders: sessions.md section 5) |
| Priority | P1 |
| Wave | 2 |
| Depends on | BE-12 |
| Parallel with | BE-15, BE-16, BE-17 |
| Owner module | M05 (reads); M03 topic progress derived here |

## Goal

All M05 learner read endpoints and the small writes around them: dashboard, subject config, chapter lists, history/progress/corrections, mastery, revision queue views, SPM targets, structured-question attempts, plus topic progress derived on read from the answer log (M03 BR-19).

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/requirements/srs/M05-practice.md`, `docs/requirements/urs/M05-practice.md`
- Mock: `src/modules/m05-practice/mock/handlers/{dashboard,chapters,subjects,revision,structured,targets,learner}.ts`, repository `src/modules/m05-practice/mock/repository/{reads,practice,rules}.ts`; client `src/modules/m05-practice/api/practice.ts`; mock tests `src/modules/m05-practice/__tests__/mock/{read-handlers,structured-targets-assigned,mastery-bulk,dashboard.perf}.test.ts`
- `docs/architecture/v2-data-migration.md` section 4.4 (mastery and accuracy read the answer dimensions, not a question join; the revision queue only for rows with a question link)
- `docs/adr/0014-store-ownership-and-repositories.md` (topic progress derived on read)
- BE-12 outputs

## Outputs

- Contract: extend `packages/contract/src/practice/**` (new files)
- `apps/api/src/modules/practice/reads/**` (SQL views or `$queryRaw` with indexes on `(user_id, subject_id, answered_at)`)
- `apps/api/prisma/schema/practice.prisma` additions: `spm_targets`, `structured_attempts` + migration (the reads need no other table)
- Tests under `apps/api/test/practice-reads/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/practice/reads/**`, and one provider-registration line in `apps/api/src/modules/curriculum/**` (same lane PC-2; BE-08 has merged because BE-12 depends on BE-09 and BE-08).
- Prisma file(s): `apps/api/prisma/schema/practice.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/practice/**` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: none.
- Tests: `apps/api/test/practice-reads/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/practice-reads/`.
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: practice.prisma was last changed by BE-12; BE-13 depends on it. BE-23 (wallet.prisma/gamification.prisma) and BE-15 do not touch it.

## Endpoints (paths from the mock)

Every route below exists in the mock (verified; the structured attempt path is `/attempts`, plural).

| Method and path | Notes |
|---|---|
| `GET /api/dashboard` | student dashboard aggregates |
| `GET /api/practice/subjects`, `GET /api/practice/subjects/:code` | list and subject config for the practice screen |
| `GET /api/practice/chapter-subjects`, `GET /api/practice/chapter-subjects/:code` | chapter practice lists |
| `GET /api/practice/history`, `GET /api/practice/progress`, `GET /api/practice/corrections`, `GET /api/practice/mastery` | history and analytics (dimension-based) |
| `GET /api/practice/revision`, `GET /api/practice/revision/:code` | revision overview/detail from the queue |
| `GET /api/practice/structured`, `GET /api/practice/structured/:id`, `POST /api/practice/structured/:id/attempts` | structured question list/detail/attempt |
| `GET /api/spm-targets`, `PUT /api/spm-targets` | student SPM targets |

`GET /api/missions/today`, `GET /api/remedial-tests/mine` and `GET /api/remedial-tests/:id` are **not** in this card: the mock reads them from M10 records through seams, and the tables are created by BE-18 (they move to BE-18, which depends on BE-12).

## DB tables touched

`practice_sessions`, `practice_answers`, `revision_queue`, `mastery`, `spm_targets`, `structured_attempts`, `curriculum` tables (read).

## Acceptance criteria

1. Each endpoint returns the mock's shape for the seeded data and parses with its contract schema. Proof: port the cases of the four mock test files in Inputs (status, body fields, `meta`).
2. Mastery, accuracy and topic progress are computed from the answer rows' dimensions (no join to `questions`); a test sets `question_id` to null and `historical` to true on every answer of a seeded student and the figures stay identical.
3. The revision queue lists only rows that still have an active question link (a test deactivates one question and the entry disappears).
4. Every list is scoped to the signed-in user; a teacher or admin reading a student's data uses the BE-19/BE-20 report endpoints, not these (a teacher calling `GET /api/practice/history` sees only own history).
5. Supporting indexes exist; `EXPLAIN` of the dashboard query for 20 seeded students plus a generated 100k-row answer table is recorded in the PR, and its median over 20 runs is under 200 ms on a developer laptop (record the number; a miss is a finding for the lead, not a blocker).
6. `PUT /api/spm-targets` validates grade ranges exactly as the mock handler does (replay the mock test cases) and is idempotent (same body twice gives the same stored row and response).
7. Structured attempt (`POST .../attempts`): marks per sub-question are returned as in `StructuredAttemptResult`; marking uses `@pp/exam-core` only if BE-14 has merged, otherwise the mock's rule (state which in the PR).
8. Topic progress (SRS BR-14 island states, BR-19 progress, 80 % mastery threshold): this card implements BE-08's `TopicProgressProvider.topicProgress(userId)` from the answer-row dimensions and registers it in the curriculum module (one provider line), so `GET /api/learning-map` and `GET /api/topics` show real progress. A test seeds answers for one student and compares the island states and "Topik Selesai" / "Kemajuan" figures with the mock formulas (`src/modules/m03-curriculum/mock/repository/progress.ts`, tests `src/modules/m03-curriculum/__tests__/mock/student-handlers.test.ts`).
9. Roles: no session 401; missing CSRF 403 `CSRF_INVALID` on the PUT/POST routes; admin-only fields are absent for students.

## Test commands

```
npm run be:test -- apps/api/test/practice-reads
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/practice-reads/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
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

1. Where do the structured question definitions come from? The mock reads them from M04 structured questions; v2 has the part tree (BE-09). Working assumption: `structured_attempts` references a question id and version from BE-09 and the mock's response shape is kept; the lead confirms in the contract PR.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-13 (practice-reads). Work in this repo clone on branch be/BE-13-practice-reads, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-13-practice-reads.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-13. Read endpoints for M05 must compute from the answer-row dimensions (v2-data-migration section 4.4), never from a live join to questions. Port response shapes from src/modules/m05-practice/api/types.ts and the mock handlers. Add the needed indexes and report a timing for the dashboard query on a generated 100k-row answer table.
```
