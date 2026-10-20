# BE-16 Bijak SPM: attempts, autosave, timer, marking, results, history

| Field | Value |
|---|---|
| Size | L |
| Lane | PC-3 (folders: sessions.md section 5) |
| Priority | P1 |
| Wave | 3 |
| Depends on | BE-15, BE-14, BE-04, BE-11 |
| Parallel with | BE-17, BE-18, BE-23 |
| Owner module | M28 Bijak SPM (attempts) |
| Security review | required (reveal rules, server clock, uploads) |

## Goal

The attempt lifecycle on the server: start/resume (exam and latihan modes), serve the attempt view without keys, autosave with revisions, offline late-sync, server-side deadline and grace sweeper, submit with idempotency key, per-question "Semak" in latihan with a cap, marking with `@pp/exam-core`, results with reveal rules, history, and working-photo upload.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/requirements/v2-bijak-spm.md` (student ACs: AC-05.x timer, AC-09.2 photos, AC-12.5 resume, reveal rules US-15, NFR-05, NFR-06), `docs/requirements/v2-bijak-spm-limitations.md`, `docs/discovery/BIJAK-SPM-cloud.md`
- `src/modules/m28-bijak-spm/server/store.ts` (all attempt methods: `findInProgress`, `startAttempt`, `getAttemptView`, `saveAnswers`, `submit`, `sweep`, `abandon`, `checkQuestion`, `getResult`, `history`; constants `GRACE_SECONDS`, `LATE_SYNC_WINDOW_MS`, `MAX_CHECKS_PER_QUESTION`, `FRESH_SECONDS`; the `BijakError` messages), `domain/types.ts` (Attempt, SavePayload, SubmitPayload, AttemptResult, ResultView, HistoryRow, QuestionCheck), `lib/autosave.ts`, `lib/photo-store.ts` (`MAX_PHOTO_BYTES`, `MAX_PHOTOS_PER_PART`, `MSG_PHOTO_TYPE`, `MSG_PHOTO_COUNT`)
- Tests that define behaviour: `src/modules/m28-bijak-spm/__tests__/{server,server-late,autosave,grading,equivalence}.test.ts`
- `packages/exam-core/` (BE-14), BE-15 tables, BE-04 files service, BE-11 wallet service (reward on completion only if the mock credits it; read `store.ts` first, otherwise none)
- Requirements: BE-FR-19, BE-FR-33; BE-NFR-17, BE-NFR-18, BE-NFR-19, BE-NFR-21, BE-NFR-29 ([URS 9.2](../../requirements/v2-backend-urs.md))
- API catalogue part B2 (learning, question bank, exam): [learning-exam.md](../../architecture/v2-api-catalogue/learning-exam.md) (endpoint list, wire conventions and open questions for this card's scope)
- Data model: [v2-data-model.md](../../architecture/v2-data-model.md) (tables, keys and indexes of this card; being written 2026-10-19)

## Outputs

- Contract: `packages/contract/src/bijak/attempts.ts`
- `apps/api/prisma/schema/exam.prisma` additions + migration: `exam_attempts` (uuid, server `deadline_at`, status, mode, `served_composition` jsonb), `attempt_answers` (part id, answer jsonb, `rev`, `saved_at`), `attempt_photos`, `attempt_results` (graded jsonb + totals), `attempt_checks`
- `apps/api/src/modules/exam/attempts/**` and a scheduled `AttemptSweeper` (`@nestjs/schedule`) that auto-submits expired exam attempts after the grace window
- Tests under `apps/api/test/exam-attempts/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/exam/attempts/**`.
- Prisma file(s): `apps/api/prisma/schema/exam.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/bijak/attempts.ts` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: none.
- Tests: `apps/api/test/exam-attempts/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/bijak/`.
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: exam.prisma was last changed by BE-15 (BE-16 depends on it). BE-39 adds no schema change, so BE-16 and BE-39 do not clash.

## Endpoints (new HTTP surface derived from `BijakServer`; all under `/api`, student role, the attempt owner only)

| Method and path | Mock method | Request | Response |
|---|---|---|---|
| `POST /api/bijak/attempts` | `startAttempt` | `{ paperId, mode: 'exam' \| 'latihan', restart? }` | `201/200 { data: { attemptId } }`; returns the open attempt unless `restart` (then the open ones become `abandoned`) |
| `GET /api/bijak/papers/:paperId/in-progress` | `findInProgress` | none | `{ data: InProgressInfo \| null }` (an attempt younger than `FRESH_SECONDS` = 60 resumes silently) |
| `GET /api/bijak/attempts/:id` | `getAttemptView` | none | `{ data: AttemptPaperView }` (sections, questions, parts, stimuli, saved answers, flags, server `deadline`/`serverNow`; **no keys, no schemes**) |
| `PUT /api/bijak/attempts/:id/answers` | `saveAnswers` | `SavePayload { changes[{partId, answer, rev, savedAt}], flags?, picks?, position? }` | `{ data: SaveResult { savedAt, closed?, regraded? } }`; per-part last-writer-wins by `rev`; late changes accepted within `LATE_SYNC_WINDOW_MS` (24 h) and re-graded |
| `POST /api/bijak/attempts/:id/submit` | `submit` | `SubmitPayload { idempotencyKey, changes, answers?, auto? }` | `{ data: SubmitResult { attemptId, late, closed?, regraded? } }`; a replay with the same key returns the same result |
| `POST /api/bijak/attempts/:id/abandon` | `abandon` | none | 204 |
| `POST /api/bijak/attempts/:id/questions/:questionId/check` | `checkQuestion` | optional `SavePayload` | `{ data: QuestionResult }` (latihan only; the count of answer-changing checks is capped at `MAX_CHECKS_PER_QUESTION` = 3; reveals the scheme for that question only) |
| `GET /api/bijak/attempts/:id/result` | `getResult` | none | `{ data: ResultView }` only after submit |
| `GET /api/bijak/history` | `history` | none | `{ data: HistoryRow[] }` of own attempts |
| `POST /api/bijak/attempts/:id/photos` | (client-side `photo-store`) | multipart via BE-04 (`purpose=bijak_photo`) with `partId` | `201 { data: PhotoMeta }`; new endpoint |

The mock error mapping (`BijakError`), reproduced with these messages: `not_found` 404 "Percubaan tidak ditemui" (attempt) / "Soalan tidak ditemui" (question); `forbidden` 403 "Akses ditolak" (another user's attempt) and 403 "Skema hanya didedahkan selepas Hantar" (check in exam mode); `not_submitted` 409 "Skema hanya didedahkan selepas Hantar" (result before submit); `bad_request` 409 `CONFLICT` "Percubaan sudah tamat" (check after close); `offline` is client-only.

## DB tables touched

`exam_attempts`, `attempt_answers`, `attempt_photos`, `attempt_results`, `attempt_checks`, `papers` and `questions` (read), `files`, `wallets`/`coin_ledger` (only if the mock credits on completion; check `store.ts`).

## Acceptance criteria

1. Port, not re-derive: every scenario of `__tests__/server.test.ts` and `__tests__/server-late.test.ts` is re-expressed as a supertest case and passes (timer deadline, grace, auto-close, late sync window, idempotent submit, resume rules, restart). A table in the PR maps each mock test name to its API test.
2. The deadline is computed from the **server clock** at start (injectable `Clock`); the client clock is never trusted (a request carrying a client `savedAt` far in the future does not extend the deadline); `serverNow` is returned.
3. Reveal rules: before submit (exam) or before "Semak" on that question (latihan) no response contains an answer key, mark scheme, accepted equivalents or explanation: a recursive key scan runs over `GET /api/bijak/attempts/:id`, every `PUT` response and `POST /api/bijak/papers/generate` outputs. In exam mode `POST .../check` returns 403 "Skema hanya didedahkan selepas Hantar"; after the 3rd check of one question in latihan (mock `MAX_CHECKS_PER_QUESTION`) a further `check` still returns that question's result but ignores any payload: the saved answer and the check count stay unchanged (test sends a changed answer with the 4th call).
4. Marking uses `@pp/exam-core` only; for the PoC papers the stored result equals the mock engine's output (golden tests over fixed answer sets, including one equivalence-marking and one maths-input case).
5. `AttemptSweeper` closes an expired exam attempt `GRACE_SECONDS` (300 s) after the deadline with status `auto_submitted` and grades whatever was saved; a late `PUT` within 24 h after the deadline is accepted and re-graded (`regraded: true`); later ones return `closed: true` and change nothing. Tests use a fixed clock.
6. Concurrency: two simultaneous submits with the same `idempotencyKey` produce one `attempt_results` row (unique constraint + test); a replay returns the same body.
7. Ownership: another user's attempt gives 403 "Akses ditolak" (mock and `v2-bijak-spm.md` NFR-06; the attempt id is a UUID; confirmed by the user, D54(b), 2026-10-19); an unknown id gives 404 "Percubaan tidak ditemui". This differs from the 404 rule of plan section 10 and is listed in the PR and in `v2-backend-deviations.md`.
8. Photos: JPEG or PNG only, at most 5 MB each (`MAX_PHOTO_BYTES`) and at most 3 per part (`MAX_PHOTOS_PER_PART`), with the mock messages "Gambar mesti JPG atau PNG, maksimum 5 MB." and "Maksimum 3 gambar bagi setiap bahagian."; a photo can only be attached to a part that accepts `working` or `drawing` answers and belongs to the caller's attempt; photos are private (only the owner reads them).
9. Writes under Mod Pelajar are stamped `is_test` and excluded from other users' history aggregates.
10. Roles: no session 401; missing CSRF 403 `CSRF_INVALID` on every PUT/POST.

## Test commands

```
npm run be:db:seed
npm run be:test -- apps/api/test/exam-attempts
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/bijak/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
4. Migration-first checklist of plan section 14.9 (items 1 to 6) is complete for every table this card creates. Item 6 (insert a `legacy_source = 'cloud'` row twice through the BE-34 upsert helper and assert one row) applies once BE-34 is merged; state in the PR whether it was available.
5. Label `security-review` on the PR; list the security decisions and the tests that prove them.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Migration-first (plan sections 14 and 14.9)

- Follow the checklist of plan section 14.9 (items 1 to 6) for every table listed under "DB tables touched".
- Each table that could receive .cloud rows has `legacy_source text null`, `legacy_id text null` and `unique (legacy_source, legacy_id)`, and is listed in `apps/api/prisma/migratable-models.json`. These columns never appear in the contract or in an API response.
- Enums are `text` + `check` with English codes (no Postgres enum types); anything the source may lack is nullable or has a documented default; seeds never set `legacy_*` and are idempotent.
- Add or update this entity's row in the mapping matrix (plan section 14.7) in the same PR.

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. **Closed by D54(b) (2026-10-19):** another user's attempt gives 403 "Akses ditolak" (mock, NFR-06), an explicit exception to the 404 rule of plan section 10 and BE-NFR-05; the exception is listed in `v2-backend-deviations.md`.
2. Does completing an attempt credit coins? Read `store.ts`; if the mock does not credit, BE-16 does not either (and BE-11 is only used for the "is_test" convention).
3. Photo retention is 12 months after the attempt (v2-bijak-spm NFR-11, default); deletion job is out of scope here. Confirm.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-16 (bijak-attempts). Work in this repo clone on branch be/BE-16-bijak-attempts, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-16-bijak-attempts.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-16 by porting the behaviour of BijakServer (src/modules/m28-bijak-spm/server/store.ts) and its tests to HTTP endpoints backed by Postgres, marking with @pp/exam-core. The server clock decides the deadline. Add a recursive scan test proving no key/scheme leaks before reveal. Use the BE-04 files service for working photos. Needs a security review: list the reveal-rule and ownership tests in the PR.
```
