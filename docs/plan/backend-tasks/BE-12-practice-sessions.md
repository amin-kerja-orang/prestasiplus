# BE-12 Practice sessions and answer log (M05 write path)

| Field | Value |
|---|---|
| Size | L |
| Wave | 2 |
| Depends on | BE-09, BE-11, BE-25 (`isSubscribed`; a stub returning true is acceptable until BE-25 merges) |
| Parallel with | BE-10, BE-15, BE-17 |
| Owner module | M05 (sessions, answers, revision queue, mastery) |

## Goal

The practice write path in one transaction, as specified by ADR-0014 section 2: start a session (trial check, question selection), check one answer, submit/complete (regrade, answer rows, revision queue, mastery counters, wallet credit, quest rewards, streak). Answer rows carry the curriculum dimensions (v2 realign) so history survives the bank reload.

## Inputs (read these)

- `docs/adr/0014-store-ownership-and-repositories.md` (section 2 is the write-path spec), `docs/requirements/srs/M05-practice.md` (BR-04, 06, 07, 08, 09, 10, 13, 14, 17, 20, 31), `docs/requirements/urs/M05-practice.md`
- Mock: `src/modules/m05-practice/mock/handlers/{sessions,common,learner,assigned,chapters,subjects}.ts`, repository `.../mock/repository/*`, tables `.../mock/tables/tables.ts`; client and types `src/modules/m05-practice/api/{practice,types}.ts` (`StartSessionRequest`, `StartSessionResponse`, `CheckAnswerResponse`, ...)
- `docs/architecture/v2-data-migration.md` section 4.4 (M05 realign: nullable `questionId`, `selectedLabel`, `historical`, dimensions on the answer row, `clientUuid`) and section 3
- BE-09 `QuestionsRepository`, BE-11 `WalletService`/`StreakService`

## Outputs

- Contract: `packages/contract/src/practice/**` (start request/response, check, submit, session, answer row)
- `apps/api/prisma/schema/practice.prisma` + migration: `practice_sessions` (uuid), `practice_answers`, `revision_queue`, `mastery`, `practice_checks`, `subject_usage`
- `apps/api/src/modules/practice/**`: `PracticeRepository` (only doorway: `startSession`, `checkAnswer`, `completeSession`, `history`, `answers`, `queue`, `mastery`)
- Seed: `apps/api/prisma/seed/practice.ts` (a few completed sessions and answers for seeded students)
- Tests under `apps/api/test/practice/**`

## Endpoints (paths from the mock)

| Method and path | Request / response (contract names to author) |
|---|---|
| `POST /api/practice/sessions` | `StartSessionRequest { mode, subjectCode?, levelId?, difficulty?, count?, chapterId?, year?, setNo?, targetQuestionId?, missionId?, remedialTestId?, questionSetId?, clientUuid? }` returns `StartSessionResponse { sessionId, mode, subject, chapter?, questions[], revisionMeta?, timeLimitSec? }`; questions never contain the correct answer |
| `POST /api/practice/sessions/:id/check-answer` | `{ questionId, optionId }` returns `{ isCorrect, correctOptionId, explanation... }` (shape per `CheckAnswerResponse`) |
| `POST /api/practice/sessions/:id/submit` | answers + elapsed; returns the session result with coins, points, streak; second submit returns 409 |
| `GET /api/practice/sessions` | paginated history of own sessions (mode filter) |

Learner read endpoints (dashboard, subjects, mastery, revision lists, targets, remedial list, missions today) are BE-13.

## DB tables touched

`practice_sessions`, `practice_answers`, `revision_queue`, `mastery`, `practice_checks`, `subject_usage`, `wallets`/`coin_ledger`/`streaks` (via BE-11 service), `questions` (via repository only).

## Acceptance criteria

1. `submit` runs in **one** DB transaction; a forced failure at any step (inject a throw after step 4) leaves no answer rows, queue changes or wallet credit (test).
2. Trial limit (BR-07): a non-subscribed user's check/answer count increments and the limit returns the mock's error and BM message; subscribed users are unlimited (`isSubscribed` from the users repository).
3. Selection uses `QuestionsRepository.eligibleForPractice` + `sample` with the seeded PRNG; deactivated or unpublished questions are never served; questions in the response never include the answer or explanation before `check-answer`.
4. Coins = correct answers; points = 10 x correct; quest rewards credited once per quest per day; idempotent via `clientUuid` (replaying `POST` with the same `clientUuid` returns the same session, no duplicates).
5. Each stored answer row has `subjectId`, `levelId`, `chapterId`, `topicId`, `difficulty`, `questionType`, `isCorrect` copied at answer time, `questionId` nullable, `historical` false for new rows.
6. Abandoned sessions record nothing; a student cannot read or submit another student's session (404).
7. Writes under Mod Pelajar are stamped `is_test`.
8. For identical seeded inputs the responses equal the mock handler's outputs on the fields tested in `src/modules/m05-practice/__tests__/mock` (document any intentional difference).

## Test commands

```
npm run be:test -- apps/api/test/practice
npm run be:verify
```

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-12 (practice-sessions). Work in this repo clone on branch be/BE-12-practice-sessions, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10); docs/plan/backend-tasks/BE-12-practice-sessions.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs.
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-12. ADR-0014 section 2 is the exact algorithm for start/check/complete; follow it in a single transaction using BE-09's QuestionsRepository and BE-11's WalletService/StreakService. Derive the contract from src/modules/m05-practice/api/types.ts and the sessions mock handler, with the v2 realignments in docs/architecture/v2-data-migration.md section 4.4. Other modules must reach practice data only through PracticeRepository. Do not implement the read dashboards (BE-13).
```
