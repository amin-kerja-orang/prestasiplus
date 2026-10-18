# BE-16 Bijak SPM: attempts, autosave, timer, marking, results, history

| Field | Value |
|---|---|
| Size | L |
| Wave | 3 |
| Depends on | BE-15, BE-14, BE-04, BE-11 |
| Parallel with | BE-17, BE-18, BE-23 |
| Owner module | M28 Bijak SPM (attempts) |
| Security review | required (reveal rules, server clock, uploads) |

## Goal

The attempt lifecycle on the server: start/resume (exam and latihan modes), serve the attempt view without keys, autosave with revisions, offline late-sync, server-side deadline and grace sweeper, submit with idempotency key, per-question "Semak" in latihan with a cap, marking with `@pp/exam-core`, results with reveal rules, history, and working-photo upload.

## Inputs (read these)

- `docs/requirements/v2-bijak-spm.md` (student ACs: AC-05.x timer, AC-12.5 resume, reveal rules US-15, NFR-05), `docs/requirements/v2-bijak-spm-limitations.md`, `docs/discovery/BIJAK-SPM-cloud.md`
- `src/modules/m28-bijak-spm/server/store.ts` (all attempt methods and constants `GRACE_SECONDS`, `LATE_SYNC_WINDOW_MS`, `MAX_CHECKS_PER_QUESTION`, `FRESH_SECONDS`), `domain/types.ts` (Attempt, SavePayload, SubmitPayload, AttemptResult, ResultView, HistoryRow, QuestionCheck), `lib/autosave.ts`, `lib/photo-store.ts`
- Tests that define behaviour: `src/modules/m28-bijak-spm/__tests__/{server,server-late,autosave,grading,equivalence}.test.ts`
- `packages/exam-core`, BE-04 files service, BE-11 wallet service (reward on completion, only if the mock credits; otherwise none)

## Outputs

- Contract: `packages/contract/src/bijak/attempts.ts`
- `apps/api/prisma/schema/exam.prisma` additions + migration: `exam_attempts` (uuid, server `deadline_at`, status, mode, `served_composition` jsonb), `attempt_answers` (part id, answer jsonb, `rev`, `saved_at`), `attempt_photos`, `attempt_results` (graded jsonb + totals), `attempt_checks`
- `apps/api/src/modules/exam/attempts/**` and a scheduled `AttemptSweeper` (`@nestjs/schedule`) that auto-submits expired exam attempts after the grace window
- Tests under `apps/api/test/exam-attempts/**`

## Endpoints (new; relative to `/api`, student role; the attempt owner only)

| Method and path | Request | Response |
|---|---|---|
| `POST /bijak/attempts` | `{ paperId, mode: 'exam' \| 'latihan', restart? }` | `201/200 { data: { attemptId } }`; returns the open attempt unless `restart` |
| `GET /bijak/papers/:paperId/in-progress` | none | `{ data: InProgressInfo \| null }` (resume prompt rule: fresh under `FRESH_SECONDS` resumes silently) |
| `GET /bijak/attempts/:id` | none | `{ data: AttemptPaperView }` (sections, questions, parts, stimuli, saved answers, flags, server `deadline`/`serverNow`; **no keys, no schemes**) |
| `PUT /bijak/attempts/:id/answers` | `SavePayload { changes[{partId, answer, rev, savedAt}], flags?, picks?, position? }` | `{ data: SaveResult { savedAt, closed?, regraded? } }`; per-part last-writer-wins by `rev`; late changes accepted within `LATE_SYNC_WINDOW_MS` and re-graded |
| `POST /bijak/attempts/:id/submit` | `SubmitPayload { idempotencyKey, changes, answers?, auto? }` | `{ data: SubmitResult { attemptId, late, closed?, regraded? } }`; replay with the same key returns the same result |
| `POST /bijak/attempts/:id/abandon` | none | 204 |
| `POST /bijak/attempts/:id/questions/:questionId/check` | optional `SavePayload` | `{ data: QuestionResult }` (latihan only; max `MAX_CHECKS_PER_QUESTION`; reveals the scheme for that question only); exam mode returns 403 with the BM message of the mock |
| `GET /bijak/attempts/:id/result` | none | `{ data: ResultView }` only after submit (409/403 `not_submitted` otherwise) |
| `GET /bijak/history` | none | `{ data: HistoryRow[] }` of own attempts |
| `POST /bijak/attempts/:id/photos` | multipart via BE-04 (`purpose=bijak_photo`) with `partId` | `201 { data: PhotoMeta }` |

Error mapping from `BijakError`: `not_found` 404, `forbidden` 403, `not_submitted` 409, `offline` n/a on the server, `bad_request` 400/422; keep the BM messages of the mock.

## DB tables touched

`exam_attempts`, `attempt_answers`, `attempt_photos`, `attempt_results`, `attempt_checks`, `papers` and `questions` (read), `files`, `wallets`/`coin_ledger` (only if the mock credits on completion; check `store.ts`).

## Acceptance criteria

1. Port, not re-derive: every scenario of `__tests__/server.test.ts` and `server-late.test.ts` is re-expressed as a supertest case and passes (timer deadline, grace, auto-close, late sync window, idempotent submit, resume rules).
2. The deadline is computed from the **server clock** at start (`Clock` injectable); the client clock is never trusted; `serverNow` is returned so the UI can sync.
3. Reveal rules: before submit (exam) or before "Semak" on that question (latihan) no response contains an answer key, mark scheme, accepted equivalents or explanation (a recursive key-scan test over `GET /bijak/attempts/:id` and `PUT` responses).
4. Marking uses `@pp/exam-core` only; given the same answers the stored result equals what the mock engine produces for the three PoC papers (golden tests).
5. `AttemptSweeper` closes an expired exam attempt after `GRACE_SECONDS` with status `auto_submitted` and grades whatever was saved; test with a fixed clock.
6. Concurrency: two simultaneous submits with the same `idempotencyKey` produce one result row (unique constraint + test).
7. A user cannot read, save to, submit or view the result of another user's attempt (404).
8. Photos: type and size limits from BE-04; photo only attachable to a part that accepts `working`/`drawing` answers; belongs to the attempt owner.
9. Writes under Mod Pelajar are stamped `is_test` and excluded from history aggregates for others.

## Test commands

```
npm run be:db:seed
npm run be:test -- apps/api/test/exam-attempts
npm run be:verify
```

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-16 (bijak-attempts). Work in this repo clone on branch be/BE-16-bijak-attempts, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10); docs/plan/backend-tasks/BE-16-bijak-attempts.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs.
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-16 by porting the behaviour of BijakServer (src/modules/m28-bijak-spm/server/store.ts) and its tests to HTTP endpoints backed by Postgres, marking with @pp/exam-core. The server clock decides the deadline. Add a recursive scan test proving no key/scheme leaks before reveal. Use the BE-04 files service for working photos. Needs a security review: list the reveal-rule and ownership tests in the PR.
```
