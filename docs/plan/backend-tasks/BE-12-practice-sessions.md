# BE-12 Practice sessions and answer log (M05 write path)

| Field | Value |
|---|---|
| Size | L |
| Lane | PC-2 (folders: sessions.md section 5) |
| Priority | P0 |
| Wave | 2 |
| Depends on | BE-09, BE-11, BE-25 |
| Parallel with | BE-10, BE-15, BE-17 |
| Owner module | M05 (sessions, answers, revision queue, mastery) |

## Goal

The practice write path in one transaction, as specified by ADR-0014 section 2: start a session (trial check, question selection), check one answer, submit/complete (regrade, answer rows, revision queue, mastery counters, wallet credit, quest rewards, streak). Answer rows carry the curriculum dimensions (v2 realign) so history survives the bank reload.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/adr/0014-store-ownership-and-repositories.md` (section 2 is the write-path spec), `docs/requirements/srs/M05-practice.md` (BR-04, 06, 07, 08, 09, 10, 13, 14, 17, 20, 31), `docs/requirements/urs/M05-practice.md`
- Mock: `src/modules/m05-practice/mock/handlers/{sessions,common,learner,assigned,chapters,subjects}.ts`, repository `src/modules/m05-practice/mock/repository/{practice,start,rules,reads,seams}.ts`, tables `src/modules/m05-practice/mock/tables/tables.ts`; client and types `src/modules/m05-practice/api/{practice,types}.ts` (`StartSessionRequest`, `StartSessionResponse`, `CheckAnswerResponse`, `SubmitSessionResponse`, `SessionListItem`); mock tests `src/modules/m05-practice/__tests__/mock/{practice-store,read-handlers,structured-targets-assigned,boundaries}.test.ts`
- Trial rule (mock): `src/modules/m01-authentication/mock/repository/users.ts` (`TRIAL_LIMIT = 50`, `trial()`, `incrementTrialUsed()`)
- `docs/architecture/v2-data-migration.md` section 4.4 (M05 realign: nullable `questionId`, `selectedLabel`, `historical`, dimensions on the answer row, `clientUuid`) and section 3
- BE-09 `QuestionsRepository`, BE-11 `WalletService`/`StreakService`, BE-25 `SubscriptionService` (trial and `isSubscribed`)
- Requirements: BE-FR-14, BE-FR-33; BE-NFR-17, BE-NFR-18, BE-NFR-19, BE-NFR-20 ([URS 9.2](../../requirements/v2-backend-urs.md))
- API catalogue part B2 (learning, question bank, exam): [learning-exam.md](../../architecture/v2-api-catalogue/learning-exam.md) (endpoint list, wire conventions and open questions for this card's scope)
- Data model: [v2-data-model.md](../../architecture/v2-data-model.md) (tables, keys and indexes of this card; being written 2026-10-19)

## Outputs

- Contract: `packages/contract/src/practice/**` (start request/response, check, submit, session, answer row)
- `apps/api/prisma/schema/practice.prisma` + migration: `practice_sessions` (uuid), `practice_answers`, `revision_queue`, `mastery`, `practice_checks`, `subject_usage`
- `apps/api/src/modules/practice/**`: `PracticeRepository` (only doorway: `startSession`, `checkAnswer`, `completeSession`, `history`, `answers`, `queue`, `mastery`)
- Seed: `apps/api/prisma/seed/practice.ts` (a few completed sessions and answers for seeded students)
- Tests under `apps/api/test/practice/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/practice/**`.
- Prisma file(s): `apps/api/prisma/schema/practice.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/practice/**` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: `apps/api/prisma/seed/practice.ts`, plus one line in `apps/api/prisma/seed/index.ts`.
- Tests: `apps/api/test/practice/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/practice/`.
- Do not touch: `apps/api/src/modules/practice/reads/**` (BE-13).
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: practice.prisma is shared with BE-13 (BE-13 depends on BE-12). BE-12 calls BE-09, BE-11 and BE-25 through their services only.

## Endpoints (paths from the mock)

Every route below exists in the mock (verified).

| Method and path | Request / response (contract names to author) |
|---|---|
| `POST /api/practice/sessions` | `StartSessionRequest { mode, subjectCode?, levelId?, difficulty?, count?, chapterId?, year?, setNo?, targetQuestionId?, missionId?, remedialTestId?, questionSetId?, clientUuid? }` (`clientUuid` is the v2 addition) returns `StartSessionResponse { sessionId, mode, subject, chapter?, questions[], revisionMeta?, timeLimitSec? }`; questions never contain the correct answer |
| `POST /api/practice/sessions/:id/check-answer` | `{ questionId, optionId }` returns `CheckAnswerResponse { isCorrect, correctOptionId, feedback, explanation }` |
| `POST /api/practice/sessions/:id/submit` | answers + elapsed; returns `SubmitSessionResponse { results { score, total, gamification { coinsEarned, streakCount, pointsEarned, totalBalance } } }`; a second submit returns 409 `ALREADY_SUBMITTED` |
| `GET /api/practice/sessions` | paginated history of own sessions (mode filter) |

Learner read endpoints (dashboard, subjects, mastery, revision lists, targets, structured attempts) are BE-13. Assigned-work reads (`GET /api/missions/today`, `GET /api/remedial-tests/mine`, `GET /api/remedial-tests/:id`) are BE-18; this card only consumes missions, remedial tests and question sets through BE-18's service for the modes `mission`, `remedial` and `question_set` (until BE-18 merges those modes return the mock's `SET_NOT_READY`; the PR says so).

## DB tables touched

`practice_sessions`, `practice_answers`, `revision_queue`, `mastery`, `practice_checks`, `subject_usage`, `wallets`/`coin_ledger`/`streaks` (via BE-11 service), `questions` (via repository only).

## Acceptance criteria

1. `submit` runs in **one** DB transaction; a forced failure at any step (inject a throw after step 4 of ADR-0014 section 2) leaves no answer rows, queue changes, mastery change or wallet credit (test per injected step).
2. Trial (BR-07, mock): a user who is not subscribed has `TRIAL_LIMIT = 50` checked answers; each `check-answer` while not subscribed adds 1 (`incrementTrialUsed`); `POST /api/practice/sessions` for a non-subscribed user with 0 remaining returns 402 `TRIAL_EXHAUSTED` with the message "Baki percubaan percuma anda telah habis."; a subscribed user is never limited (`SubscriptionService.isSubscribed` from BE-25).
3. Mock error table, each tested with its exact status, code and BM message: 409 `ALREADY_SUBMITTED` "Sesi ini sudah dihantar."; 409 `CHAPTER_LOCKED` "Bab ini masih dikunci." (previous chapter not complete with score at least 70, `UNLOCK_SCORE`); 422 `NOT_ENOUGH_QUESTIONS` "Soalan tidak mencukupi."; 422 `SET_NOT_READY` "Soalan tidak mencukupi."; 422 `NO_WRONG_QUESTIONS` "Maaf, terdapat masalah memuatkan kuiz ulang kaji."; 409 `ALREADY_COMPLETED` "Misi ini sudah diselesaikan." / "Ujian ini sudah selesai."; 409 `NO_ATTEMPTS_LEFT` "Tiada percubaan lagi untuk set ini."; invalid answer "Jawapan tidak sah."; count options 5, 10, 15, 20; revision length 20.
4. Selection uses `QuestionsRepository.eligibleForPractice` + `sample` with the seeded PRNG; deactivated or unpublished questions are never served; questions in the start response never include the answer or the explanation before `check-answer` (recursive key scan over the response).
5. Rewards: points = 10 x correct (`POINTS_PER_CORRECT`); coins per the mock (`sessionCoins`, `MISSION_COINS_PER_CORRECT` for missions) credited through `WalletService` once per session (idempotent source key); quest rewards at most once per quest per Malaysia day; the streak is touched once per day. Replaying `POST /api/practice/sessions` with the same `clientUuid` returns the same session and creates no duplicate.
6. Each stored answer row has `subjectId`, `levelId`, `chapterId`, `topicId`, `difficulty`, `questionType` and `isCorrect` copied at answer time, `questionId` nullable, `historical` false for new rows, `selectedLabel` and `clientUuid` per v2-data-migration 4.4.
7. A session that is started but never submitted records no answer rows; a student cannot read, check or submit another student's session (404).
8. Writes under Mod Pelajar are stamped `is_test`.
9. Mock parity: for identical seeded inputs the responses equal the mock handler's outputs on the fields asserted in `src/modules/m05-practice/__tests__/mock/practice-store.test.ts` (document any intentional difference in the PR and the deviations log).
10. Roles: no session 401; missing CSRF 403 `CSRF_INVALID`; every route needs a signed-in user (any role).

## Test commands

```
npm run be:test -- apps/api/test/practice
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/practice/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
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

1. The trial limit of 50 and the +1-per-checked-answer rule are a provisional M19 rule in the mock (overview 6.7); the real subscription derivation is Q6. Working assumption: keep the mock rule.
2. Points and coins per session come from the mock `sessionCoins` curve; confirm the v2 economy (BE-23 may change it).
3. Later tables (URS 13.4 item 4): assigned-mode starts (`missionId`, `remedialTestId`, `questionSetId`) read tables created by BE-18, and quest rewards are credited through BE-23. Until those cards merge, keep the fields in the contract and put each behind a port with a no-op default (an unknown assignment returns the mock's not-found error; the quest reward port credits nothing). BE-18 and BE-23 enable them when they merge. (added 2026-10-19)

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-12 (practice-sessions). Work in this repo clone on branch be/BE-12-practice-sessions, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-12-practice-sessions.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-12. ADR-0014 section 2 is the exact algorithm for start/check/complete; follow it in a single transaction using BE-09's QuestionsRepository and BE-11's WalletService/StreakService. Derive the contract from src/modules/m05-practice/api/types.ts and the sessions mock handler, with the v2 realignments in docs/architecture/v2-data-migration.md section 4.4. Other modules must reach practice data only through PracticeRepository. Do not implement the read dashboards (BE-13).
```
