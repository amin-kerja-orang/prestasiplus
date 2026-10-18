# BE-13 Practice read models: dashboard, subjects, mastery, revision, targets

| Field | Value |
|---|---|
| Size | M |
| Wave | 2 |
| Depends on | BE-12 |
| Parallel with | BE-15, BE-16, BE-17 |
| Owner module | M05 (reads); M03 topic progress derived here |

## Goal

All M05 learner read endpoints and the small writes around them: dashboard, subject config, chapter lists, history/progress/corrections, mastery, revision queue views, SPM targets, structured-question attempts, plus topic progress derived on read from the answer log (M03 BR-19).

## Inputs (read these)

- `docs/requirements/srs/M05-practice.md`, `docs/requirements/urs/M05-practice.md`
- Mock: `src/modules/m05-practice/mock/handlers/{dashboard,chapters,subjects,revision,structured,targets,learner,assigned}.ts`; client `src/modules/m05-practice/api/practice.ts`
- `docs/architecture/v2-data-migration.md` section 4.4 (mastery and accuracy read the answer dimensions, not a question join; revision queue only for rows with a question link)
- `docs/adr/0014-store-ownership-and-repositories.md` (topic progress derived on read)
- BE-12 outputs

## Outputs

- Contract: extend `packages/contract/src/practice/**`
- `apps/api/src/modules/practice/reads/**` (SQL views or `$queryRaw` with indexes on `(user_id, subject_id, answered_at)`)
- `apps/api/prisma/schema/practice.prisma` additions: `spm_targets`, `structured_attempts` + migration
- Tests under `apps/api/test/practice-reads/**`

## Endpoints

| Method and path | Notes |
|---|---|
| `GET /api/dashboard` | student dashboard aggregates |
| `GET /api/practice/subjects`, `GET /api/practice/subjects/:code` | list and subject config for the practice screen |
| `GET /api/practice/chapter-subjects`, `GET /api/practice/chapter-subjects/:code` | chapter practice lists |
| `GET /api/practice/history`, `GET /api/practice/progress`, `GET /api/practice/corrections`, `GET /api/practice/mastery` | history and analytics (dimension-based) |
| `GET /api/practice/revision`, `GET /api/practice/revision/:code` | revision overview/detail from the queue |
| `GET /api/practice/structured`, `GET /api/practice/structured/:id`, `POST /api/practice/structured/:id/attempt` | structured question list/detail/attempt (confirm the exact mock paths in `practice.ts`) |
| `GET /api/spm-targets`, `PUT /api/spm-targets` | student SPM targets |
| `GET /api/remedial-tests/mine`, `GET /api/missions/today` | read side; creation is BE-18 |

## DB tables touched

`practice_sessions`, `practice_answers`, `revision_queue`, `mastery`, `spm_targets`, `structured_attempts`, `curriculum` tables (read).

## Acceptance criteria

1. Each endpoint returns the mock's shape for seeded data and parses with its contract schema.
2. Mastery, accuracy and topic progress are computed from the answer rows' dimensions (no join to `questions`); a test deletes the source question row's availability (set `question_id` null, `historical` true) and the figures stay unchanged.
3. The revision queue lists only rows that still have an active question link.
4. Every list is scoped to the signed-in user; a teacher/admin reading a student's data uses the BE-19/BE-20 report endpoints, not these.
5. Queries have supporting indexes; `EXPLAIN` on the dashboard query for 20 seeded students plus a generated 100k-row answer table stays under 200 ms locally (record the number in the PR).
6. `PUT /api/spm-targets` validates grade ranges as the mock does and is idempotent.

## Test commands

```
npm run be:test -- apps/api/test/practice-reads
npm run be:verify
```

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-13 (practice-reads). Work in this repo clone on branch be/BE-13-practice-reads, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10); docs/plan/backend-tasks/BE-13-practice-reads.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs.
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-13. Read endpoints for M05 must compute from the answer-row dimensions (v2-data-migration section 4.4), never from a live join to questions. Port response shapes from src/modules/m05-practice/api/types.ts and the mock handlers. Add the needed indexes and report a timing for the dashboard query on a generated 100k-row answer table.
```
