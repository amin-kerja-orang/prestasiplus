# BE-48 Heatmap Topik Lemah read model (M25)

| Field | Value |
|---|---|
| Size | S |
| Lane | PC-2; approved by the LEAD 2026-10-19 (folders: sessions.md section 5; the rows to add are in "Files touched") |
| Priority | P1 |
| Wave | 3 |
| Depends on | BE-12, BE-13, BE-08 |
| Parallel with | BE-15, BE-16, BE-17, BE-46, BE-47 |
| Owner module | M25 AI Centre (new module `heatmap`; **no tables**: a read model, D12) |

## Goal

(D53: every module reachable in the prototype is in B1; matrix row 14 "Heatmap Topik Lemah", `/buku-nota/heatmap`, Murid.) Serve the one M25 route: the signed-in learner's weak-topic heatmap, grouped by subject, computed on every request from the answer log. It creates no table and keeps no copy of any other module's data (D12, G-12, G-15); there is no AI call (BR-M25-12).

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/requirements/srs/M25-ai-centre.md` (route #1, BR-M25-01 to BR-M25-04, BR-M25-10, FR-M25-26 to FR-M25-30, K-M25-01, Q-M25-HM-ROWS / CELLS / HIDDEN, section 6.5 reconciliation), `docs/requirements/urs/M25-ai-centre.md`
- Mock: `src/modules/m25-ai-centre/mock/handlers/index.ts` (the one route), `mock/repository/heatmap.ts` (the algorithm), `api/{settings,types,heatmap}.ts` (constants `HEATMAP_MIN_ATTEMPTS`, `bandOf`, `percentOf`); mock tests `src/modules/m25-ai-centre/__tests__/{heatmap,ties}.test.ts`
- `docs/plan/backend-tasks/BE-13-practice-reads.md` (reads over the answer dimensions, no join to questions; indexes), `docs/plan/backend-tasks/BE-12-practice-sessions.md` (`practice_answers`, `PracticeRepository`), `docs/plan/backend-tasks/BE-08-curriculum.md` (chapters, subjects, order)
- `docs/architecture/v2-data-migration.md` section 4.4 (statistics read the answer-row dimensions, not a question join)
- `docs/requirements/role-access-matrix.md` (Murid row 14; not for Guru or Admin Sekolah)
- Requirements: BE-FR-45; BE-NFR-15 (read performance, as BE-13)
- API catalogue part B2: [learning-exam.md section 9 (M25-01)](../../architecture/v2-api-catalogue/learning-exam.md#9-m25-ai-centre-1-route); its OQ-API-B2-11 is closed for this route by this card
- Data model: [v2-data-model.md](../../architecture/v2-data-model.md) tables `practice_answers` (owner BE-12), `chapters`, `subjects` (owner BE-08); URS OQ-13 (the heatmap route belonged to no card) is closed by this card

## Outputs

- Contract: `packages/contract/src/heatmap/**` (new): `HeatmapTopic`, `HeatmapSubject`, `HeatmapResponse`, the constants `HEATMAP_MIN_ATTEMPTS = 5` and the band rule; registered in `src/openapi.ts`
- `apps/api/src/modules/heatmap/**`: the controller and `HeatmapService` (pure functions for percent, band and ordering; no repository of its own)
- One read method added to BE-13's practice reads: `PracticeRepository.chapterAnswerCounts(userId, minAttempts)` returning `{chapterId, attempts, correct}[]` (SQL `GROUP BY chapter_id` over `practice_answers`, no join to `questions`)
- Tests under `apps/api/test/heatmap/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/heatmap/**`; and the one method above inside `apps/api/src/modules/practice/reads/**` (same lane PC-2; BE-13 has merged because BE-48 depends on it).
- Prisma file(s): none. No table, no migration. If `EXPLAIN` shows no usable index for the user's answer rows, open a `cross-lane` issue for a BE-12 migration (do not add a migration here).
- Contract: `packages/contract/src/heatmap/**` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: none. Tests use the BE-12 answer seeds or fixtures they create.
- Tests: `apps/api/test/heatmap/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/heatmap/`.
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (no entry: no table); your own rows of the mapping matrix, plan section 14.7 (one row, "derived, no table"); `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: nothing under `prisma/schema/` is edited. Curriculum is read through BE-08's repository, answers through `PracticeRepository`; no other module's table is queried directly.

## Endpoints (1 mock route, path from the mock)

| Method and path | Notes |
|---|---|
| `GET /api/buku-nota/heatmap` | roles `student` and `admin` only; the data is always the session user's own |

- Guard: no session 401 `UNAUTHORIZED` "Unauthenticated."; any role other than `student` or `admin` (teacher, parent, school admin, officers): 403 `FORBIDDEN` "This action is unauthorized." Any query parameter is ignored (no user parameter exists).
- Response 200 `{data: {subjects: HeatmapSubject[]}}` with `HeatmapSubject = {subjectId, name, topics: HeatmapTopic[]}` and `HeatmapTopic = {chapterId, name, attempts, correct, percent, band}`; ids are decimal strings (UD-1); `percent` an integer 0 to 100; `band` is `'red' | 'amber' | 'green'` (never `gray`).
- Rules (BR-M25-02 to BR-M25-04, FR-M25-27/28):
  1. Base: the caller's own answers that have a chapter dimension, grouped by `chapter_id` (never by name). Answers without a chapter are not grouped. `attempts` = number of those answers, `correct` = those with `is_correct = true`.
  2. A chapter is shown only when `attempts >= 5` (`HEATMAP_MIN_ATTEMPTS`, K-M25-01).
  3. `percent = floor((200 x correct + attempts) / (2 x attempts))` (round half up, integer arithmetic).
  4. `band`: `red` when `percent < 50`, `amber` when `50 <= percent <= 79`, `green` when `percent >= 80`; the band is taken on the rounded percent.
  5. Name and subject come from the curriculum (chapter `name`, its `subject_id`, the subject `name`). A shown chapter whose chapter or subject cannot be found in the curriculum is skipped.
  6. Order of topics inside a subject: raw accuracy ascending (compare `correct_a x attempts_b` with `correct_b x attempts_a`, exact integers, not the rounded percent), then topic name ascending (code-unit comparison as the mock, see Open questions 2), then chapter id ascending (numeric order of the bigint, not string order). Order of subjects: curriculum subject order (`sort_order`) ascending, then subject id (numeric).
  7. A subject with no shown chapter has no block; with no shown chapter at all the body is `{"data": {"subjects": []}}` (the screen shows its empty state).

## DB tables touched

None created. Read only, through owners' repositories: `practice_answers` (BE-12, columns `user_id`, `chapter_id`, `is_correct`, `is_test` only), `chapters` and `subjects` (BE-08). No table, no cache table, no materialised view in B1 (G-15: derived values are not stored twice).

The mapping-matrix row for this entity: "Heatmap Topik Lemah: derived; no old table, no new table; computed from `practice_answers` and `chapters`/`subjects`; schema card none; ETL none". Because the historical `practice_answers` rows migrated by BE-29 carry the chapter snapshot dimension (`historical = true`), migrated learners show a heatmap without a question join; nothing is migrated for M25 itself ("not migrated").

## Acceptance criteria

1. The route returns the mock's shape and parses with its contract schema. Proof: port `heatmap.test.ts` and `ties.test.ts` to seeded fixtures: the observed figures (six cells in the observed order, 116 attempts / 45 correct shown and 3 / 1 hidden for the designed student, 3 Matematik cells 37 / 26 ordered 43, 57, 83), a student with no data returns `subjects: []`.
2. Population: answers without a chapter are not grouped; a chapter with 4 attempts is hidden and with 5 is shown; two chapters with equal names are separate cells (grouped by id).
3. Percent and band edges: 49.5 gives 50 (amber), 79.5 gives 80 (green), 0 correct gives 0 red, all correct gives 100 green; a unit test covers `percentOf` for every pair up to 20 attempts against the formula.
4. Order: equal-accuracy cells order by name then by numeric chapter id (a test with ids 9 and 10 proves numeric, not string, order); subjects follow `sort_order` then numeric id; the accuracy order uses exact fractions (a case where two chapters round to the same percent but differ in raw accuracy).
5. Own data only: a query string `?userId=...` is ignored; two students seeded with different answers each see only their own cells; a teacher or parent session gets 403 `FORBIDDEN`; no session gets 401; an admin gets 200 with the admin's own data.
6. Agreement with M05 (BR-M25-10): for every shown cell, `attempts` and `correct` equal the BE-13 aggregate for the same user and chapter (a test calls both); the shown plus hidden counts equal the user's total answers.
7. Independence from the question bank (BE-13 AC2): after setting `question_id = null` and `historical = true` on every answer of a seeded student the response is identical; deactivating a question changes nothing.
8. The query reads the dimension columns only (no join to `questions`); `EXPLAIN` of the grouping query for one of 20 seeded students with a generated 100k-row answer table is pasted in the PR, and its median over 20 runs is under 200 ms on a developer laptop (a miss is a finding for the lead, not a blocker).
9. Test mode: the rows counted follow BE-13's rule for `is_test` on the caller's own reads (state it in the PR; Open questions 3).

## Test commands

```
npm run be:test -- apps/api/test/heatmap
npm run be:test -- apps/api/test/practice-reads
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/heatmap/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
4. Migration-first checklist of plan section 14.9: no table is created, so items 1 to 6 do not apply; state "no table" in the PR and add the mapping-matrix row "derived, no table".
5. No security review is required; list any security-relevant decision in the PR anyway (own data only, role gate).
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Migration-first (plan sections 14 and 14.9)

- This card creates no table, so there are no `legacy_*` columns and no `migratable-models.json` entry.
- It must keep working for migrated learners: it reads only the snapshot dimensions (`chapter_id`, `is_correct`) of `practice_answers`, never `question_id`, so historical rows count (BE-13 AC2).
- Add the mapping-matrix row (plan section 14.7) in the same PR: Heatmap = derived, no table, no ETL.

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. The same screen also shows the "Cikgu Pakar" card from `GET /api/duta/recommendations`, a route registered by the M06 mock (M06-14) that is served by BE-41. This card does not build it; the screen calls BE-41 once that card has merged, and it is not a blocker for BE-48.
2. The SRS says topic ties are broken by name with ms-MY collation, but the mock compares names by plain code-unit order (`a.name < b.name`), and the mock tests pass with that. Working assumption: replicate the mock (code-unit comparison); a Malay-collation change is a deviation to be agreed first.
3. Test mode (G-07): an admin in Mod Pelajar writes `is_test = true` answers, so an admin heatmap would be empty if test rows were excluded, while BE-19 excludes `is_test` from aggregates. Working assumption: follow whatever BE-13 does for the caller's own `GET /api/practice/mastery` and state it in the PR; the lead confirms.
4. K-M25-01 (minimum 5 attempts) is a constant of the mock; the SRS notes any value from 3 to 5 reproduces the observation. Working assumption: constant 5 in the contract folder, not configurable.
5. The index `(user_id, subject_id, answered_at)` serves a per-user scan, not a per-user chapter group. Working assumption: the scan of one learner's rows is fast enough (AC 8); if not, the lead decides on an index `(user_id, chapter_id)` in BE-12's Prisma file.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-48 (heatmap-topik-lemah). Work in this repo clone on branch be/BE-48-heatmap-topik-lemah, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-13-practice-reads.md; docs/plan/backend-tasks/BE-48-heatmap-topik-lemah.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/heatmap/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handler, repository (src/modules/m25-ai-centre/mock/repository/heatmap.ts), typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. This is a read model: create no table and no copy of another module's data; read answers through PracticeRepository (add the one chapterAnswerCounts method in practice/reads) and chapters/subjects through the BE-08 repository; never join to the questions table. Do not edit src/**, e2e/**, docs/TRACKER.md, any Prisma file or the contract common/session/auth/access folders. Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoint done, real test output (including the EXPLAIN and timing), deviations from the mock/contract, open questions.
Task: implement BE-48. One route; chapters with at least 5 answers, half-up percent, bands, exact-fraction ordering, numeric id tie-breaks, role gate student and admin, own data only.
```
