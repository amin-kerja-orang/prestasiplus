# BE-41 SPM hub: Tahun Lepas, Latih Tubi, Tracking A, Subjektif, mock exams (M06)

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-3 (proposed; lane table: sessions.md section 5; reason below) |
| Priority | P1 |
| Wave | 3 |
| Depends on | BE-03, BE-08, BE-09, BE-12, BE-13 |
| Parallel with | BE-16, BE-18, BE-19, BE-23, BE-42 |
| Owner module | M06 (Tracking A sets, SPM subject config, SPM mock exams, Duta cards hosted for M24) |

Lane and priority reason (proposal for the LEAD, per D53): the folders `apps/api/src/modules/spm/**`, `prisma/schema/spm.prisma` and `packages/contract/src/spm/**` belong to no lane today, so no file clashes with any PC. PC-3 already owns the other SPM surface (Bijak SPM, `exam/`) and has the lightest P1 load; PC-2 is full with P0 cards and PC-6 owns reports. P1 because the student menu row 13 "SPM" is reachable in the prototype and the `ramalan` start of BE-12 needs this card's set service; nothing else is blocked by it.

This card is **not replaced by Bijak SPM** (M28, BE-15/BE-16). Both live under `/spm`: M06 is the classic hub (Tahun Lepas, Latih Tubi, Tracking A, Subjektif, mock exam), M28 is the paper-based flow.

## Goal

Serve the 14 M06 mock routes so the `/spm` hub, Databank (Tahun Lepas), Latih Tubi setup, Tracking A, Subjektif overview, the SPM mock exam (generate, sit, submit, result), the simulated walkthrough and the Duta recommendation card work against the real API. Almost everything M06 shows is **computed** from other owners' stores (curriculum BE-08, questions BE-09, practice BE-12/BE-13); the card owns only the SPM subject configuration, the Tracking A set records, the mock exams and the Duta card list. The quiz screens themselves (Q1 Tahun Lepas, Q2 Latih Tubi, Q3 Tracking A set, structured answer page, history S10) are **not M06 routes**: they use the M05 routes `POST /api/practice/sessions` (modes `past_year`, `latih_tubi`, `ramalan`), `GET /api/practice/sessions?modes=...` and `/api/practice/structured*`, built by BE-12 and BE-13.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5, `docs/plan/backend-dev-guide.md`
- `docs/requirements/srs/M06-spm.md` (sections 4 BR-M06-01 to BR-M06-30, 6 data, 7 mock API, 8 messages, 11 SEC-M06-01 to -10, 13 open questions) and `docs/requirements/urs/M06-spm.md`; role matrix: `docs/requirements/role-access-matrix.md` row 13 "SPM" (Murid; the mock guard is any signed-in role)
- Mock: `src/modules/m06-spm/mock/handlers/{spm,mocks,duta}.ts` (14 routes), `mock/repository/{spm,rules}.ts`, `mock/tables/tables.ts`, `mock/data/config.ts` (subject config, targets, mock subjects, walkthrough subjects, grade bands, canned walkthrough text, `TRACKING_YEAR`, `COUNT_OPTIONS`), `mock/constants/display.ts` (hub display constants), `mock/seeds/seed.ts`; client and types `src/modules/m06-spm/api/{spm,types}.ts`; mock tests `src/modules/m06-spm/__tests__/mock/{spm,mocks}.test.ts`
- API catalogue part B2: [learning-exam.md section 6, M06-01 to M06-14](../../architecture/v2-api-catalogue/learning-exam.md#6-m06-spm-classic-14-routes) (shapes, errors and BM messages are documented there; this card links them and does not repeat them)
- Data model: [v2-data-model.md](../../architecture/v2-data-model.md) global rules G-01 to G-18 and [section 3.13](../../architecture/v2-data-model.md#313-mock-stores-without-a-card-backlog-and-mock-only) (the `m06.trackingSets` and `m06.mockExams` rows were backlog; D53 promotes them to B1 and this card defines the tables below)
- `docs/architecture/v2-backend-plan.md` sections 5, 6, 14 (14.7 mapping matrix, 14.9 checklist); `docs/architecture/v2-data-migration.md` section 4.5
- `docs/requirements/v2-backend-urs.md` (UD-1: ids are decimal strings and the session follows the contract; D53)
- Services of other owners that this card calls and never bypasses (ADR-0014, D12): BE-08 `CurriculumService` (subjects, levels), BE-09 `QuestionsService` (SPM pool counts and samples, structured questions, serve-shape of a question), BE-12/BE-13 `PracticeRepository` (history stats over the modes `past_year`, `latih_tubi`, `ramalan`; structured attempts with scope `spm`)
- Requirements: BE-FR-38, BE-NFR-05, BE-NFR-20 ([URS 9.2](../../requirements/v2-backend-urs.md))

## Outputs

- Contract: `packages/contract/src/spm/**` (overview, databank subject, Latih Tubi card and config, Tracking A hub, subject and set shapes, Subjektif overview, mock list item, mock exam view, mock result and item, walkthrough request and raw response, Duta card)
- `apps/api/prisma/schema/spm.prisma` + migration: `spm_subject_configs`, `spm_tracking_sets`, `spm_tracking_set_questions`, `spm_mock_exams`, `spm_mock_exam_items`, `duta_profiles` (provisional owner, M24 not built)
- `apps/api/src/modules/spm/**`: controller, `SpmHubService` (read models), `SpmTrackingService` (sets; exports `ramalanQuestionIds(subjectId, year, setNo)` for BE-12), `SpmMockService`, `WalkthroughService` (simulated), `DutaService`; pure rules file (`setStatus`, `gradeOf`, `heroClassOf`, `markPaper2`, `weakTopicsOf`)
- Seed `apps/api/prisma/seed/spm.ts`: the 19 `spm_subject_configs` rows (reference data), a few fictitious Duta rows, and for the dev/PoC profile a handful of Tracking A sets built from the seeded bank (one registry line)
- Tests under `apps/api/test/spm/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/spm/**`.
- Prisma file(s): `apps/api/prisma/schema/spm.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/spm/**` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: `apps/api/prisma/seed/spm.ts`, plus one line in `apps/api/prisma/seed/index.ts`.
- Tests: `apps/api/test/spm/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/spm/`.
- Do not touch: `apps/api/src/modules/{questions,practice,curriculum}/**` (other lanes; ask for a service method with a `cross-lane` issue), `apps/api/src/modules/exam/**` (Bijak, PC-3's other cards; this card shares nothing with it).
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical; this card lists none except what the open question on `spm_mock_exams` decides); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: `spm.prisma` belongs to this card alone. Table `spm_mock_exams` is **not** `exam_attempts` (BE-16 owns that table); the two never share rows or code.

## Endpoints (14 mock routes, paths from the mock; shapes in the catalogue)

Every route below exists in the mock (verified, `route(` registrations in `handlers/{spm,mocks,duta}.ts`). All routes need a signed-in user of any role (no role guard); the only role-dependent field is `readiness` of M06-05.

| Catalogue id | Method and path | Notes |
|---|---|---|
| [M06-01](../../architecture/v2-api-catalogue/learning-exam.md#m06-01-get-apispmoverview) | `GET /api/spm/overview` | hub stats, module chips, caller's SPM practice stats |
| M06-02 | `GET /api/spm/databank` | 18 subjects in databank order with pool size |
| M06-03 | `GET /api/spm/latih-tubi` | `{ teras, elektif }` cards |
| M06-04 | `GET /api/spm/latih-tubi/:code` | setup data; 404 `NOT_FOUND` "Not Found." for an unknown code |
| M06-05 | `GET /api/spm/tracking-a` | hub; `readiness` only for active role `admin` |
| M06-06 | `GET /api/spm/tracking-a/:code` | set list for the Tracking year, or `{ redirect }` for BM and BI |
| M06-07 | `GET /api/spm/subjektif` | 15 subjects and the caller's structured-attempt stats |
| M06-08 | `GET /api/spm-mocks` | caller's mocks, newest first (bare array, no `meta`) |
| M06-09 | `POST /api/spm-mocks` | 201 `{ data: { id } }` |
| M06-10 | `GET /api/spm-mocks/:id` | exam paper without keys; owner only |
| M06-11 | `POST /api/spm-mocks/:id/submit` | grade and return the result; owner only |
| M06-12 | `GET /api/spm-mocks/:id/result` | result; owner only |
| M06-13 | `POST /api/spm-walkthrough/solve` | multipart; raw `{ ok, walkthrough \| error }` body, HTTP 200 for business errors |
| M06-14 | `GET /api/duta/recommendations` | `DutaCard \| null`; hosted here, M24 will take it over with the same path and body |

Not in this card: the quiz and history routes (BE-12, BE-13) and every Bijak SPM route (BE-15, BE-16, BE-39).

## DB tables touched

Owned (defined here, following v2-data-model global rules: bigint identity ids serialised as decimal strings (G-01, UD-1), `timestamptz`, English enum codes as `text` + `check`, no soft delete, one owner per store (G-12)):

| Table | Columns (all `not null` unless stated) | Keys, checks, indexes |
|---|---|---|
| `spm_subject_configs` | `id`, `subject_id` (FK `subjects.id`), `grp` text (`teras`, `elektif`), `display_order` int, `databank_order` int null (null = not on the Tahun Lepas list), `target_type` text null (`spm`, `custom`, `latihan`), `target_size` int null, `created_at`, `updated_at` | `unique (subject_id)`; checks on `grp` and `target_type`; `check ((target_type is null) = (target_size is null))`. Replaces the mock `SPM_SUBJECTS` constants (19 rows, from `mock/data/config.ts`: group order, databank order, targets) |
| `spm_tracking_sets` | `id`, `subject_id` (FK), `year` int, `set_no` int, `dskp_tagged` int default 0, `created_at`, `updated_at` | `unique (subject_id, year, set_no)`; index `(subject_id, year)`. Status, ready count and bank size are **computed on read** (G-15), never stored |
| `spm_tracking_set_questions` | `set_id` (FK cascade), `question_id` (FK `questions.id`), `position` int | `unique (set_id, position)`, `unique (set_id, question_id)`; index `(question_id)` |
| `spm_mock_exams` | `id` uuid (see open question 4), `user_id` (FK), `subject_id` (FK), `subject_label` text (the S11 option text, snapshot), `paper_number` smallint (`1`, `2`), `status` text (`in_progress`, `submitted`), `created_at`, `submitted_at` null, `score` int null, `max_score` int, `percent` numeric(5,2) null, `grade` text null (`A+`, `A`, `B+`, `B`, `C`, `D`, `E`, `G`), `is_test` boolean default false | index `(user_id, created_at desc)`; checks on enums; `is_test` stamped from Mod Pelajar (G-07) |
| `spm_mock_exam_items` | `id`, `mock_exam_id` (FK cascade), `item_no` int, `question_id` bigint null (FK `questions.id`, on delete set null), `question_text` text, `options` text[] null (Paper 1 only), `model_answer` text, `student_answer` text null, `marks` int null, `max_marks` int, `feedback` text null, `topic` text | `unique (mock_exam_id, item_no)`. A snapshot of the question as served, so a later edit of the bank cannot change a sat mock (G-18) |
| `duta_profiles` | `id`, `slug` text, `name`, `initials`, `tier` text (`bintang`, `inspirasi`, `tetamu`), `tagline`, `subject` text, `state` text, `rating` numeric(3,2), `is_active` boolean, `created_at`, `updated_at` | `unique (slug)`. **Provisional owner** (the mock hosts `GET /api/duta/recommendations` in M06; the real owner M24 is not built). Rows are fictitious in seeds |

Read through services only (never queried directly): `subjects`, `education_levels`, `questions` and its tags, `practice_sessions`, `structured_attempts`, `users`.

Migration-first notes (plan 14.9): the 19 reference rows and every other table have **no .cloud source** (`spm_sets` and `spm_set_question` of .cloud are plain question lists and are not migrated, `v2-data-migration.md` 4.5), so none of these tables carries `legacy_*` columns except as decided by open question 5; each is listed in the mapping matrix as "not migrated" with the reason.

## Acceptance criteria

Each criterion is a test in `apps/api/test/spm/**`; the mock tests named in Inputs are the oracle (port them to supertest). Messages are copied from the mock.

1. Roles: every route returns 401 without a session and works for `student`, `teacher` and `admin` (any signed-in role); missing CSRF on a POST is 403 `CSRF_INVALID`. `readiness` of M06-05 is `null` for every active role except `admin` and a non-null object for `admin` (test with a role switch).
2. M06-02 returns the subjects that have a `databank_order`, sorted by it, each with `databankCount` equal to the SPM pool size of the subject from `QuestionsService`; a deactivated or unpublished question is not counted. M06-03 groups by `grp` ordered by `display_order`; `locked` is true only when `target_size` is set and `total < target_size`.
3. M06-04: unknown code answers 404 `NOT_FOUND` "Not Found."; with a target the only `countOptions` entry is `{ value: target, label: "<target> (Target <SPM|Custom|Latihan>)", isTarget: true }` and `defaultCount = target`; without a target the options are 5, 10, 20, 30, 40, 50, 60 (`isTarget: false`) and `defaultCount = 10`; `difficultyStats` and `difficultyByLevel` carry the keys `"1"` to `"5"` (key `"1"` may be 0).
4. Set status rule (BR-M06-08), unit-tested and then through M06-05/M06-06 with fixtures for all three statuses: `size` = subject target or 40; `readyCount` = min(eligible questions of the set, size); `belum_cukup` when `readyCount < size`; `bank_besar` when the eligible count is greater than `size`; otherwise `bersih`. Startable = not `belum_cukup`. A question that stops being eligible leaves the set count without any write to `spm_tracking_sets`.
5. M06-05: `openSubjects` lists only non-bahasa subjects with at least one startable set, teras before elektif; the two bahasa subjects are in `bahasa`; `bahasaLane.subjects` is 2; the admin `readiness` tiles follow the readiness order of the mock (subjects with a target), with `readiness = round((bersih + bankBesar) / total * 100)` (0 with no sets) and at most 6 `lockedSets`. M06-06: BM and BI answer `{ redirect: "/latihan-berstruktur?subject_id=<1|2>&scope=spm&track=bahasa" }` where the id is the subject id as in the mock fixture (see open question 8); other subjects list startable sets first, then locked, each by set number, and `summary.readyQuestions` is the sum over all sets (unlike the S5 card).
6. Tracking A selection for BE-12: `ramalanQuestionIds(subjectId, year, setNo)` returns `null` for an unknown set, `[]` for a `belum_cukup` set, otherwise the eligible question ids in `position` order cut to `size`; a unit test pins it and BE-12's `ramalan` mode binds to it (see Open questions 2).
7. M06-07: `subjects` has the 15 Subjektif subjects (teras first, then by name in the `ms` locale); `sets` = number of student-visible structured questions of the subject from `QuestionsService`; the stats count only the caller's structured attempts with scope `spm` (`bestScore` is the best attempt percentage rounded, `null` with no attempt). Another user's attempts never change the figures.
8. M06-01: `me` equals the BE-13/BE-12 history stats over the modes `past_year`, `latih_tubi`, `ramalan` for the caller only; `yearsAvailable` is 0 (the bank has no year on questions in the mock; see open question 1); `trackingAQuestions` is the sum of the ready counts of all sets.
9. M06-09 validation: `subject` must be one of the ten S11 options (Bahasa Melayu, English, Matematik, Matematik Tambahan, Fizik, Kimia, Biologi, Sains, Sejarah, Pendidikan Islam) else 422 `VALIDATION_ERROR` with `fields.subject` "Sila pilih subjek."; `paperNumber` absent or null means 1, anything but 1 or 2 is 422 `fields.paperNumber` "Paper mesti 1 atau 2.". Paper 1 stores 30 objective items sampled with a seeded PRNG from the SPM pool (1 mark each), Paper 2 stores 6 structured items of 10 marks from visible structured questions of the subject, shuffled; `max_score` is the sum of item marks. The call writes nothing to practice, mastery, revision queue or wallet (assert row counts of those tables are unchanged).
10. M06-10 / M06-11 / M06-12 ownership: a mock of another user, or an unknown id, answers 404 `NOT_FOUND` "Not Found." on all three routes; the paper view never contains `modelAnswer`, `studentAnswer`, `marks` or `feedback` (recursive key scan).
11. Submit (M06-11): second submit is 409 `CONFLICT` "Mock ini sudah dihantar."; `answers` must be an array of `{ no: integer 1..item count, answer?: string | null }` else 422 `fields.answers` "Jawapan tidak sah."; answers are trimmed and truncated to 5000 characters. Paper 1: correct iff the trimmed upper-cased answer equals the model letter (1 or 0 marks), feedback "Tahniah, jawapan anda betul." or "Jawapan yang betul ialah <X>."; Paper 2 (simulated marker): 0 marks for an empty answer, otherwise `round(max * min(1, words / 60))`, feedback "Jawapan anda merangkumi <m> daripada <max> markah. Rujuk skema.". `percent` has 2 decimals; grade bands >= 90 A+, 80 A, 70 B+, 60 B, 50 C, 45 D, 40 E, else G; `heroClass` is `bad` for G, `mid` for C, D, E, else `good`; `weakTopics` lists topics with an item below max marks, count descending then topic name (`ms` locale). Submit writes only `spm_mock_exams` and `spm_mock_exam_items`.
12. M06-12 on an `in_progress` mock answers 409 with code `NOT_SUBMITTED` and message "Mock belum dihantar."; M06-08 returns only the caller's mocks, newest first, with `score`, `percent`, `grade` null while in progress.
13. Walkthrough (M06-13): `subject` not in the 15 listed (the ten S11 subjects plus Pendidikan Moral, Geografi, Ekonomi, Perdagangan, Prinsip Akaun) is 422 `fields.subject` "Sila pilih subjek."; an image that is not `image/*` or is over 5 MB answers HTTP 200 `{ ok: false, error: "Gambar tidak sah." }`; no text and no image answers 200 `{ ok: false, error: "Sila masukkan soalan atau muat naik gambar soalan." }`; otherwise 200 `{ ok: true, walkthrough: "Soalan: <first 80 characters of the trimmed text, or (gambar)>\n\n<canned text>" }` with the canned text per subject of the mock (Matematik, Sejarah, otherwise the default text). No external call is made and the uploaded image is never stored (SEC-M06-05); the simulated delay is configurable (mock default 1500 ms, tests set 0).
14. M06-14: with `?seed=<int>` the pick is deterministic; with `?subject=` an active `bintang` profile of that subject is preferred when one exists, otherwise any active `bintang`; `inspirasi` and `tetamu` and inactive rows are never returned; `{ data: null }` when none is active.
15. Display figures: the hub constants of the mock (`HUB_TOTAL_QUESTIONS`, `HUB_POOL_CHIP`) are not copied; the real backend computes them from the pool (assumption in open question 1) and the PR records the chosen definitions.
16. Contract: every response parses with its zod schema; ids on the wire are decimal strings (UD-1), the mock exam id is the uuid string; `npm run contract:check` passes.

## Test commands

```
npm run be:test -- apps/api/test/spm
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/spm/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
4. Migration-first checklist of plan section 14.9 (items 1 to 6) is complete for every table this card creates. Item 6 (insert a `legacy_source = 'cloud'` row twice through the BE-34 upsert helper and assert one row) applies only to a table that open question 5 makes migratable; state in the PR whether BE-34 was available.
5. No security review is required; list the security-relevant decisions in the PR anyway (ownership checks on mocks, key-free paper view, walkthrough upload limits and no image retention, admin-only readiness).
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Migration-first (plan sections 14 and 14.9)

- Follow the checklist of plan section 14.9 (items 1 to 6) for every table listed under "DB tables touched".
- A table that could receive .cloud rows has `legacy_source text null`, `legacy_id text null` and `unique (legacy_source, legacy_id)` and is listed in `apps/api/prisma/migratable-models.json`. None of this card's tables is migratable by default (see the table notes); the matrix row says so.
- Enums are `text` + `check` with English codes (no Postgres enum types); seeds never set `legacy_*` and are idempotent.
- Add or update this entity's rows in the mapping matrix (plan section 14.7) in the same PR.

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. **SPM pool and hub figures (blocking for counts).** The mock counts a "SPM pool" (`spmPool` facet on questions). In v2 the data model maps it to `question_tags` kind `pool` "or paper placement" and BE-09 has no pool count or sample method. Working assumption: BE-09 exposes `countSpmPool({ subjectId, levelId?, difficulty? })` and `sampleSpmPool(...)` over published questions flagged as SPM pool; if it does not, open a `cross-lane` issue to PC-2 before starting and do not read `questions` or `question_tags` yourself. The three hub figures that the mock keeps as display constants (total questions 20,529, Databank chip and Latih Tubi chip 14,673) have no definition: working assumption is the sum of the pool counts of the subjects shown, computed live, and `yearsAvailable` stays 0.
2. **`ramalan` mode binding in BE-12.** BE-12's start request carries `year` and `setNo` but its card does not name this card's set service. Working assumption: BE-12 reaches Tracking A sets through a port with a no-op default (unknown set error as in the mock, `SET_NOT_READY`), and this card binds the port to `SpmTrackingService.ramalanQuestionIds`. The LEAD should add one line to BE-12 (and its open question 3) to say so.
3. **Who creates Tracking A sets.** The mock has no route that writes sets (seed only) and .cloud sets are not migrated. B1 therefore ships the read side and the seed only. Confirm that no admin set-builder route is expected in B1, and who loads the production sets.
4. **Mock exam id.** The mock uses sequential numbers and SEC-M06-08 warns about enumeration; G-01 gives attempt-like records a uuid. Working assumption: uuid, ownership still enforced with 404. Confirm, because the frontend route `/spm-mock/:id` then carries a uuid.
5. **Reuse of `exam_attempts` and migration of .cloud mock history.** `v2-data-migration.md` 4.5 says the .cloud `exam_attempts` header "migrates" and plan 14.7 sends it to BE-16 `exam_attempts`, but a classic mock is not a paper attempt. Working assumption: `spm_mock_exams` stays separate and not migrated (no `legacy_*`); the LEAD decides whether old mock headers should be loaded here.
6. **Structured-question mapping for Paper 2.** The mock takes the stem of the first sub-question as the item text and joins all sub-question model answers with a newline. Confirm how that maps to the BE-09 part tree (which part is "first", which key text is the model answer). Until answered, use the first leaf part in order and the concatenated `model_text` of its answer keys, and list it in the deviations file.
7. **Level keys on the wire.** `levelCounts` and `difficultyByLevel` use the mock level ids `"10"` and `"11"` (Tingkatan 4 and 5) as keys. Under UD-1 ids are decimal strings assigned by the database. Working assumption: the keys are the `education_levels.id` strings of the two levels resolved by BE-08's `grade` (T4, T5); the contract PR documents it and the LEAD realigns the frontend (V2-T31).
8. **BM and BI subject ids in the redirect.** The redirect URL embeds `subject_id=1` or `2` (mock ids). Working assumption: the real subject id of the Bahasa Melayu or English subject as a decimal string.
9. **Tracking year.** The mock fixes the year at 2026 (`TRACKING_YEAR`). Working assumption: a constant in the module config (no `settings` table exists in B1); confirm.
10. **Rate limits and monthly limits.** SEC-M06-04 (cost abuse of the walkthrough) and URS OQ-M06-05 (monthly mock limit, time limit, auto-close of `in_progress` mocks) are open in the SRS; the mock has none. Build none; the PR lists the default limits of the platform throttler only.
11. **Real AI for the walkthrough.** The mock is simulated (D4) and the SRS places the real call out of B1 (OD-7). Keep the canned behaviour behind `WalkthroughService`; whether BE-36 later provides the real solver is out of scope.
12. **Duta ownership.** `GET /api/duta/recommendations` is also declared by the M25 client. Confirm that this card hosts it and that `duta_profiles` is a temporary table that M24 later takes over.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-41 (spm-hub). Work in this repo clone on branch be/BE-41-spm-hub, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-41-spm-hub.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-41. Port the 14 routes of src/modules/m06-spm/mock/handlers/{spm,mocks,duta}.ts. Almost every figure is computed from other owners' services (BE-08 curriculum, BE-09 questions, BE-12/BE-13 practice): call those services and never read their tables. This card owns only spm_subject_configs, spm_tracking_sets, spm_tracking_set_questions, spm_mock_exams, spm_mock_exam_items and duta_profiles. Keep the set status, grading, grade bands and weak-topic rules as pure functions with unit tests ported from the mock tests. Never send answer keys to the client before submit, enforce mock ownership with 404, and keep the walkthrough simulated with no external call and no image retention.
```
