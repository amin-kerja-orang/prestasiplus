# BE-43 Cikgu Alesa: chat, RPH, essay markings, PBD tags (M13)

| Field | Value |
|---|---|
| Size | L |
| Lane | PC-5 (proposed: it owns BE-36, whose adapter this card calls, and no file of PC-5's other cards overlaps; folders: sessions.md section 5, to be extended with the rows in "Files touched") |
| Priority | P2 |
| Wave | 4 |
| Depends on | BE-36 (provider-agnostic AI adapter), BE-03, BE-05, BE-08, BE-12, BE-17 |
| Parallel with | BE-20, BE-21, BE-22, BE-40, BE-46, BE-47, BE-48 |
| Owner module | M13 Cikgu Alesa (new module `cikgu`; owns all five tables below) |
| Security review | required (child names inside essays, text sent to an external AI through BE-36, raw un-enveloped endpoint, CSV export) |

## Goal

(D53: every module reachable in the prototype is in B1; matrix row 37 "Cikgu Alesa".) Build all 10 M13 mock routes: the chat turn `POST /api/cikgu/send` (any signed-in role), and the teacher tools (RPH list/create/detail, essay markings list/detail, PBD queue, roll-up, bulk approve, CSV export; role `teacher` or `admin`). The mock's canned replies, canned marks and canned RPH text become the behaviour of the `mock` AI provider; a real provider is reached only through the BE-36 adapter. No provider SDK, key or HTTP client to an AI vendor exists in this module.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/plan/backend-tasks/BE-36-ai-extraction-service.md` (adapter interface, redaction, rate limit, cost log, budget; this card consumes it)
- `docs/requirements/srs/M13-cikgu-alesa.md` (section 7 routes, BR-M13-01 to BR-M13-23, FR-M13-24 to FR-M13-28, FR-M13-46, FR-M13-48, FR-M13-64 to FR-M13-67, section 8.2 canned texts, section 6 data), `docs/requirements/urs/M13-cikgu-alesa.md`
- Mock: `src/modules/m13-cikgu-alesa/mock/handlers/index.ts` (the 10 routes), `mock/repository/{cikgu,canned,types}.ts`, `mock/tables/tables.ts`, `mock/seeds/seed.ts`; client `src/modules/m13-cikgu-alesa/api/{cikgu,types,settings}.ts`; mock tests `src/modules/m13-cikgu-alesa/__tests__/mock/{cikgu-handlers,canned,csv-cell}.test.ts`
- Other-owner reads (repositories only, ADR-0014 / D12): BE-05 `UsersRepository.get` (student names), BE-08 curriculum repository (active subject names), BE-12 `PracticeRepository.answers` (roll-up), BE-17 `ClassesRepository` (`forTeacher`, `memberIds`, class name and subject)
- `docs/requirements/role-access-matrix.md` (Murid row 37 "Cikgu Alesa"; the teacher tools have no matrix row of their own, see Open questions 5)
- Requirements: BE-FR-NEW-43 (wording proposed in the report; number assigned by the integrator of [URS 9.2](../../requirements/v2-backend-urs.md)); BE-NFR-05, BE-NFR-06, BE-NFR-19 (Malaysia day), BE-NFR-31 to BE-NFR-36 through BE-36
- API catalogue part B2: [learning-exam.md section 8 (M13-01 to M13-10)](../../architecture/v2-api-catalogue/learning-exam.md#8-m13-cikgu-alesa-10-routes); its OQ-API-B2-11 (non-enveloped body) is closed by this card
- Data model: [v2-data-model.md](../../architecture/v2-data-model.md) section 3.13 row "cikgu.*" (candidate tables `chat_threads`, `chat_messages`, `rph_plans`, `essay_markings`, `pbd_tags`; they become B1 tables through this card) and the global rules G-01 to G-18
- Migration: [v2-data-migration.md](../../architecture/v2-data-migration.md) rows for `chatbot_conversations` / `chatbot_messages` (section 3, "Reshape") and the open question near line 317; plan [v2-backend-plan.md](../../architecture/v2-backend-plan.md) sections 5, 6, 14.7

## Outputs

- Contract: `packages/contract/src/cikgu/**` (new): chat request/response (snake_case, un-enveloped), `Rph`, `RphListItem`, `RphCreateRequest`, `EssayMarking`, `EssayListItem`, `PbdQueueItem`, `RollupResult`, `BulkApproveResult`, the constants `RUBRICS`, `LEVELS`, `TIERS` (see "Constants"), registered in `src/openapi.ts`. The OpenAPI document marks `POST /api/cikgu/send` and `GET /api/cikgu/pbd/export.csv` as explicit non-`{data}` responses.
- `apps/api/prisma/schema/cikgu.prisma` + migration: `chat_threads`, `chat_messages`, `rph_plans`, `essay_markings`, `pbd_tags`
- `apps/api/src/modules/cikgu/**`: controllers for the 10 routes, `CikguRepository` (the only doorway to the five tables), `CikguAiPort` (interface) with `MockCikguAi` (canned logic ported from `canned.ts`) and `AdapterCikguAi` (delegates to the BE-36 adapter), the pure rule functions (routing, hand-off parser, RPH request parser, RPH content, TP bands, CSV cell)
- Seed `apps/api/prisma/seed/cikgu.ts` (fictitious, small, idempotent; one line in the registry)
- Tests under `apps/api/test/cikgu/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/cikgu/**`.
- Prisma file(s): `apps/api/prisma/schema/cikgu.prisma` (new, this card alone) and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/cikgu/**` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: `apps/api/prisma/seed/cikgu.ts`, plus one line in `apps/api/prisma/seed/index.ts`.
- Tests: `apps/api/test/cikgu/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/cikgu/`.
- Other files: `.env.api.example` only if a new key is needed, in the PC-5 block (names only).
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (`ChatMessage`, `ChatThread`, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row for the raw-body exception and any other deviation); your own row in `docs/plan/backend-tracker.md`.
- Cross-lane (issue first, label `cross-lane`): BE-36 must expose a text-generation capability (see Open questions 1). Same lane PC-5, so the BE-36 owner adds it; BE-43 does not edit `ai-extraction/**`.
- No-clash note: `cikgu.prisma` and the `cikgu` module folder belong to this card alone. BE-36 (`ai.prisma`), BE-17 and BE-12 are read through their services only.

## Endpoints (10 mock routes, paths from the mock)

Guard S = any signed-in user. Guard T = role `teacher` or `admin`: no session 401 `UNAUTHORIZED` "Unauthenticated.", any other role 403 `FORBIDDEN` "This action is unauthorized." (standard error envelope). POST routes need the CSRF header (missing: 403 `CSRF_INVALID`). Page size is fixed at 20; `ListMeta` as in the common contract; an out-of-range page is an empty page that keeps the requested page; an invalid `page` means 1.

| Method and path | Guard | Notes |
|---|---|---|
| `POST /api/cikgu/send` | S | **Raw (un-enveloped) bodies**, see section "Chat turn" |
| `GET /api/cikgu/rph` | T | own RPHs, `lessonDate` desc then `id` desc; `{data: RphListItem[], meta}` |
| `POST /api/cikgu/rph` | T | validate, generate canned content, 201 `{data: Rph}` |
| `GET /api/cikgu/rph/:id` | T | 200 `{data: Rph}`; unknown, foreign or non-numeric id: 404 `NOT_FOUND` "Not Found." |
| `GET /api/cikgu/essays` | T | own markings, `createdAt` desc then `id` desc; `{data: EssayListItem[], meta}` |
| `GET /api/cikgu/essays/:id` | T | 200 `{data: EssayMarking}`; 404 as above |
| `GET /api/cikgu/pbd` | T | own **pending** tags; `{data: PbdQueueItem[], meta}` |
| `POST /api/cikgu/pbd/rollup` | T | body `{classroomId}`; 200 `{data: {created, updated, skipped}}` |
| `POST /api/cikgu/pbd/bulk-approve` | T | body `{ids}`; 200 `{data: {approved}}` |
| `GET /api/cikgu/pbd/export.csv` | T | raw `text/csv`; attachment `pbd-approved.csv` |

Thread, RPH, essay, tag, class and student ids are decimal strings on the wire (UD-1); `thread_id` is an opaque string the client only echoes back (see Open questions 4). Everything below keeps the mock's rules.

### Chat turn (`POST /api/cikgu/send`)

- Guard: a guest gets HTTP 401 with body exactly `{}` (not the error envelope). Implement with a route-level filter; do not change BE-03 common code (cross-lane issue if impossible).
- Request: `{message: string, thread_id?: string | null}`. A non-string or blank (after trim) `message`: 422 body `{}` (checked before the thread and the AI call; nothing is stored). A `thread_id` that is not a string, unknown, or another user's starts a new thread (no error, no leak).
- Daily quota (BR-M13-06), by the caller's role: `admin` tier `admin` 100 turns, `teacher` tier `guru` 30, every other role tier `pelajar` 10. Used = the caller's `role = 'user'` messages created on today's date in `Asia/Kuala_Lumpur` (injectable `Clock`). If used >= limit: 429 body `{"quota_exhausted": true}` and nothing is stored. Count-check and insert run in one transaction under a per-user advisory lock so concurrent requests cannot exceed the limit.
- Routing of the reply (BR-M13-04), first match on the trimmed message, case-insensitive: (1) starts with `Tolong mark karangan ini menggunakan rubric ` runs the `mark_essay` tool; (2) contains `rph` runs the RPH tool; (3) contains `latihan` or `soalan` returns the practice reply (tool `practice`); (4) otherwise the general reply (no tool). Routing is deterministic string logic on the server in every provider mode.
- Success 200 body, snake_case, no envelope: `{thread_id, reply, tier: 'admin'|'guru'|'pelajar', turns_remaining, tool_hops: 0|1, tokens: {in, out}}`. `turns_remaining = limit - (used + 1)`. `tool_hops` = 1 when the turn ran `mark_essay`, saved an RPH or returned practice questions, else 0 (the RPH follow-up question is 0). With the mock AI: `tokens.in = 120 + ceil(codepoints(message) / 4)`, `tokens.out = ceil(codepoints(reply) / 4)` (Unicode code points of the trimmed message and of the reply).
- Stored per turn: the thread (created, or `updated_at` set), one `user` message (tool null, hops 0, tokens 0, 0) and one `bot` message (tool, hops, tokens in/out), same `created_at`.
- `mark_essay` (BR-M13-08/09): parse the hand-off message (markers `. Subjek: `, `. Level: `, `. Pelajar: `, `. Tajuk: `, `. Karangan: `; rubric label = one of the six labels, unknown label falls back to the first rubric); marks = `round(0.7 x max)` (35/50, 35/50, 21/30, 21/30, 14/20, 70/100); reply = the marking text below; insert an `essay_markings` row (rubric, subject, level, student, title, essay text, marks, max, comment = the reply, thread).
- RPH tool (BR-M13-10): subject = the longest active subject name contained in the message (case-insensitive); level = the first token `T1`-`T5`/`D1`-`D6` or `Tingkatan n`/`Darjah n`; tajuk = the text after the level token with a trailing `esok` or `hari ini` removed (empty gives `{subject} {level label}`); lesson date = tomorrow if the message contains `esok`, else today (Malaysia date); duration 60. With subject and level: insert an `rph_plans` row (`source = 'chat'`, `thread_id`), reply = the confirmation text, hops 1. Otherwise reply = the follow-up text, hops 0, nothing saved.
- AI port: the reply text, essay marks/comment and RPH content come from `CikguAiPort`. With `AI_PROVIDER=mock` it is the canned logic of `canned.ts`, byte for byte. A real provider goes through the BE-36 adapter (redaction, rate limit, cost log, budget); this card adds no vendor call.

### Teacher tools

- `POST /api/cikgu/rph` body `{subjectName, level, tajuk, className?, lessonDate?, durationMinutes?, timeSlot?, tema?, pengajaranKeperluan?}`. Server-side checks (BR-M13-12), all values trimmed, lengths in Unicode code points, errors collected then returned together as 422 `VALIDATION_ERROR` with `fields` in this insertion order: `subjectName` (required; max 100), `level` (required; one of `D1`-`D6`, `T1`-`T5`, else "Medan ini tidak sah."), `tajuk` (required; max 200), `durationMinutes` (integer 15 to 240, else "Tempoh mesti antara 15 dan 240 minit."; default 60), `lessonDate` (`YYYY-MM-DD` and a real date, else "Tarikh tidak sah."; empty or missing gives today in Malaysia), `pengajaranKeperluan` (max 500), `className` (max 100), `timeSlot` (max 100), `tema` (max 100). Optional text fields: blank becomes null. Top-level `message` = first field message plus ` (and N more error(s))` when several.
- Created RPH: `status = 'generated'`, `source = 'form'`, `thread_id` null, `content` = canned plan text (below), 201 `{data: Rph}`.
- `POST /api/cikgu/pbd/rollup`: `classroomId` accepted as a digit string or an integer; anything else, a class that is not the caller's, or a class without a subject: 200 `{created:0, updated:0, skipped:0}` and no change. Otherwise, for every active member of the class that has at least one answer in the class subject: skor = `round(correct / answered x 1000) / 10` over all that student's answers in the subject (rows with `is_test = true` excluded); tp by bands (`<20` 1, `<40` 2, `<60` 3, `<75` 4, `<90` 5, else 6); sp = `5.1.1` for subject name `Kimia`, `1.1.1` for `Sejarah` and for every other subject. An existing `pending` tag for (teacher, class, student, sp) gets new skor/tp and `created_at = now` (`updated`); else if a tag exists (approved) it is left alone (`skipped`); else a new `pending` tag (`created`).
- `POST /api/cikgu/pbd/bulk-approve`: `ids` items that are digit strings (trimmed) or integers are kept, others dropped; duplicates count once; only the caller's `pending` tags become `approved` with `approved_at = now`; foreign or non-pending ids are ignored silently; `approved` = how many changed. Not an array or empty: `{approved: 0}`.
- `GET /api/cikgu/pbd` row: `{id, studentId, studentName, classroomId, sp, skor, tp}`; order `created_at` desc, then student name A to Z (case-insensitive, Malay collation as `Intl.Collator('ms', {sensitivity: 'base'})`), then `id`.
- `GET /api/cikgu/pbd/export.csv`: UTF-8, `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="pbd-approved.csv"`. First line `pelajar,kelas,sp,skor,tp,tarikh_lulus`; one line per approved tag of the caller ordered by `approved_at` (else `created_at`), student name, `id`; `skor` with one decimal (`toFixed(1)`), `tarikh_lulus` = `YYYY-MM-DD` (Malaysia date of approval); a cell starting with `=`, `+`, `@` or `-` gets a leading `'`; a cell containing `"`, `,`, CR or LF is double-quoted with inner quotes doubled; lines end with `\n`, including the last; with no approved tag the body is the header line only.

### Constants (exact copy; shared via the contract folder)

Rubrics (key, label, max): `spm_bm_karangan` "SPM Bahasa Melayu — Karangan (Bahagian B) (50 markah)" 50; `spm_bi_continuous_writing` "SPM English — Continuous Writing (Section B) (50 markah)" 50; `pt3_bm_karangan` "PT3 Bahasa Melayu — Karangan (30 markah)" 30; `pt3_bi_essay` "PT3 English — Essay (30 markah)" 30; `sejarah_essay` "Sejarah — Karangan Esei (20 markah)" 20; `general` "Rubric Am (default) (100 markah)" 100. Levels: `D1`-`D6` "Darjah 1"-"Darjah 6", `T1`-`T5` "Tingkatan 1"-"Tingkatan 5".

Canned texts (the `mock` provider; `\n` = line break):

- General reply: `Soalan yang baik! Ini penerangan ringkas:` / `1. Mulakan dengan konsep asas dan satu contoh mudah.` / `2. Kaitkan konsep itu dengan pengalaman harian murid.` / `3. Akhiri dengan 2–3 soalan semakan kefahaman.` / `Nak saya sediakan latihan soalan untuk topik ini?`
- Practice reply: `Ini 3 soalan latihan ringkas:` / `1. Nyatakan maksud konsep utama topik ini.` / `2. Berikan satu contoh konsep ini dalam kehidupan harian.` / `3. Terangkan perbezaan antara dua konsep yang berkaitan.` / `Cuba jawab dahulu, kemudian hantar jawapan untuk saya semak.`
- RPH follow-up: `Boleh nyatakan subjek, tingkatan/tahun dan tajuk? Contoh: "Tolong jana RPH untuk Matematik T4 Bab 3 esok".`
- RPH confirmation: `Siap! RPH "{tajuk}" ({subject}, {level label}) untuk {dd/mm/yyyy} telah dijana dan disimpan dalam senarai RPH.`
- Marking reply: `Markah: {marks}/{max}` / `Rubric: {rubric label}` / `Komen membina:` / `1. Isi: idea utama jelas; tambah satu contoh untuk setiap isi.` / `2. Bahasa: ayat gramatis; kurangkan pengulangan perkataan.` / `3. Cadangan: kukuhkan penutup dengan rumusan yang merujuk tajuk.`
- RPH content: header line `{subject} · {level label}`; `Kelas: {className}` (if given); `Tarikh: {dd/mm/yyyy}`; `Masa: {timeSlot}` (if given); `Tempoh: {n} minit`; `Tajuk: {tajuk}`; `Tema: {tema}` (if given); blank line; `Standard Kandungan: rujuk DSKP {subject} {level label} — {tajuk}`; `Standard Pembelajaran: rujuk DSKP {subject} {level label} — {tajuk}`; blank; `Objektif Pembelajaran`; `1. Menyatakan konsep utama {tajuk} dengan betul.`; `2. Menerangkan {tajuk} dengan contoh yang sesuai.`; `3. Menyelesaikan sekurang-kurangnya 3 daripada 4 soalan berkaitan {tajuk}.`; blank; `Aktiviti PdPc`; `Set Induksi ({a} minit)`; `Aktiviti 1 ({b} minit)`; `Aktiviti 2 ({b} minit)`; `Aktiviti 3 ({d} minit)`; `Penutup ({e} minit)`; blank; `BBM: buku teks, lembaran kerja, slaid ringkas`; `EMK: kreativiti dan inovasi`; `PBD Assessment plan: pemerhatian semasa Aktiviti 2 dan lembaran kerja (TP1–TP6)`; `Keperluan Khas: {text}` last, if given. Minutes: `a = round(0.10 x total)`, `e = round(0.15 x total)`, `b = floor((total - a - e) / 3)`, `d = total - a - e - 2b` (60 gives 6/15/15/15/9). Lines joined with `\n`.

## DB tables touched

New (owner this card): `chat_threads`, `chat_messages`, `rph_plans`, `essay_markings`, `pbd_tags`. Read through other owners' services: users (BE-05), subjects (BE-08), classes and enrolments (BE-17), practice answers (BE-12).

| Table | Columns (types per G-01 to G-10) | Keys and indexes |
|---|---|---|
| `chat_threads` | `user_id` FK users, `created_at`, `updated_at`, `is_test` | index `(user_id, updated_at)`; legacy columns (G-03) |
| `chat_messages` | `thread_id` FK cascade, `user_id` FK (copy of the thread owner, for the quota query), `role` check `user`/`bot`, `text`, `tool` null check `mark_essay`/`rph`/`practice`, `tool_hops` smallint check 0/1, `tokens_in`, `tokens_out` int, `created_at`, `is_test` | index `(user_id, created_at)` for the daily count; `(thread_id, created_at)`; legacy columns |
| `rph_plans` | `user_id` FK, `subject_name` (<=100), `level` check D1..D6/T1..T5, `tajuk` (<=200), `class_name`, `lesson_date` date, `duration_minutes` smallint check 15..240, `time_slot`, `tema`, `pengajaran_keperluan` (nullable text), `status` check `generated`, `source` check `form`/`chat`, `content` text, `thread_id` FK null, `created_at`, `is_test` | index `(user_id, lesson_date desc, id desc)` |
| `essay_markings` | `user_id` FK, `rubric_key` check the six keys, `subject_name`, `level`, `student_name`, `essay_title` (all nullable free text), `essay_text`, `marks` int, `max_marks` int, `comment`, `thread_id` FK, `created_at`, `is_test` | index `(user_id, created_at desc, id desc)` |
| `pbd_tags` | `user_id` FK (teacher), `classroom_id` FK, `student_id` FK users, `sp` text, `skor` numeric(4,1), `tp` smallint check 1..6, `status` check `pending`/`approved`, `created_at` (roll-up time), `approved_at` null, `is_test` | `unique (user_id, classroom_id, student_id, sp)`; partial index on `status = 'pending'` by `(user_id, created_at desc)` |

`rph_plans`, `essay_markings` and `pbd_tags` are born in v2 (no .cloud source): no legacy columns, not in `migratable-models.json`. `chat_threads` and `chat_messages` are the v2 side of the .cloud `chatbot_conversations` / `chatbot_messages` (anonymous public-site chatbot, `visitor_id`, ratings): they carry `legacy_source`, `legacy_id` and the unique pair so a later promotion needs no migration, but **nothing is loaded in B1** ("not migrated", plan 14.7 row to add; Open questions 6). `essay_markings.student_name` and the essay text are child data typed by a teacher: never logged, never copied to any other table, sent to an AI provider only after BE-36 redaction.

## Acceptance criteria

1. Every route returns the mock's status and body for the seeded data and parses with its contract schema. Proof: port the cases of `cikgu-handlers.test.ts`, `canned.test.ts` and `csv-cell.test.ts`.
2. Guards: every T route returns 401 to a guest and 403 to student, parent and other non-teacher roles with the standard envelope; `POST /api/cikgu/send` returns exactly `401` with body `{}` to a guest; missing CSRF on a POST gives 403 `CSRF_INVALID`.
3. Chat raw bodies are exact: 200 `{thread_id, reply, tier, turns_remaining, tool_hops, tokens}` with no `data` wrapper; blank or missing message 422 `{}`; quota reached 429 `{"quota_exhausted": true}` with no `error` key. A test asserts the raw JSON text.
4. Quota: a teacher gets 30 turns a day (tier `guru`, `turns_remaining` 29 on the first), a student 10 (`pelajar`), an admin 100 (`admin`); the 31st teacher turn is 429 and stores nothing; with the clock moved past 00:00 Asia/Kuala_Lumpur the count resets. A concurrency test sends 40 parallel turns as a teacher and exactly 30 succeed.
5. Thread rules: `thread_id` null, unknown, non-string or another user's creates a new thread; the same id continues it and both messages are stored; another user's thread is never touched or revealed.
6. Routing and tools: the hand-off message stores one `essay_markings` row with the parsed rubric/subject/level/student/title/essay and marks = round(0.7 x max) for all six rubrics; `Tolong jana RPH untuk Matematik T4 Bab 3 esok` stores an RPH (subject Matematik, T4, tajuk `Bab 3`, tomorrow's date, duration 60, source `chat`); an RPH request without subject or level replies with the follow-up text, hops 0, stores nothing; "latihan"/"soalan" returns the practice reply with hops 1; anything else the general reply with hops 0. Replies equal the canned texts above character for character.
7. Tokens follow the formula with code points (a test with an emoji message).
8. `POST /api/cikgu/rph` validates exactly as BR-M13-12: one test per field and message above, several errors at once (top-level message `... (and N more error(s))`), defaults (date today, duration 60), content equals the canned plan for 60 minutes (6/15/15/15/9) and for another duration (a=round, split).
9. Ownership (BR-M13-01, FR-M13-48): lists and detail return only the caller's rows; a foreign or unknown id and a non-numeric id are 404 `NOT_FOUND` "Not Found."; the admin sees only own (empty) rows.
10. Ordering and paging: RPH by lesson date desc then id desc; essays newest first; pending tags newest roll-up first then name A-Z (case and diacritic insensitive); 20 per page, `meta` correct, a page beyond the last is empty and keeps the requested page.
11. Roll-up: for a seeded class and Kimia/Sejarah answers it returns the same counts, skor, tp and sp as the mock tests; re-running updates pending tags (`updated`), skips approved ones (`skipped`), creates for new students; null, foreign or subject-less class changes nothing (200 zeros); `is_test` answers are ignored.
12. Bulk approve and export: only the caller's pending tags are approved, duplicates once, foreign/non-pending/garbage ids ignored; the CSV equals the layout above for a seeded set, a `=SUM(1)` student-name fixture is exported as `'=SUM(1)`, a name with a comma or quote is quoted, and an empty set returns the header line only with the attachment headers.
13. AI port: with `AI_PROVIDER=mock` the replies equal the canned logic; swapping the provider in a contract test changes no controller code; a provider failure or `AI_BUDGET_EXHAUSTED` returns the card's error (Open questions 3), stores nothing and does not consume a quota turn.
14. Privacy: a grep test over captured logs and the BE-36 request body canary shows no essay text, student name or user id outside the redacted payload; `ai_usage_logs` rows written for this card contain no content.
15. Supporting indexes exist; `EXPLAIN` of the daily-count query for a user with 10k messages is recorded in the PR (index only scan on `(user_id, created_at)`).

## Test commands

```
npm run be:test -- apps/api/test/cikgu
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/cikgu/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
4. Migration-first checklist of plan section 14.9 (items 1 to 6) is complete for every table this card creates (items 1 to 6 apply to `chat_threads` and `chat_messages`; state that the other three have no source). Item 6 (insert a `legacy_source = 'cloud'` row twice through the BE-34 upsert helper and assert one row) applies once BE-34 is merged; state in the PR whether it was available.
5. Label `security-review` on the PR; list the security decisions and the tests that prove them (raw-body guard, privacy canary, CSV guard, ownership 404, advisory lock).
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Migration-first (plan sections 14 and 14.9)

- Follow the checklist of plan section 14.9 (items 1 to 6) for every table listed under "DB tables touched".
- Each table that could receive .cloud rows (`chat_threads`, `chat_messages`) has `legacy_source text null`, `legacy_id text null` and `unique (legacy_source, legacy_id)`, and is listed in `apps/api/prisma/migratable-models.json`. These columns never appear in the contract or in an API response.
- Enums are `text` + `check` with English codes (no Postgres enum types); the rubric keys, tool names and `pending`/`approved` are the mock's codes; anything the source may lack is nullable or has a documented default; seeds never set `legacy_*` and are idempotent.
- Add or update this entity's row in the mapping matrix (plan section 14.7) in the same PR: `chatbot_conversations`/`chatbot_messages` to `chat_threads`/`chat_messages`, "not migrated in B1"; RPH, essays and PBD tags "no source".

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. BE-36's `ExtractionProvider` has `extractPaper`, `suggestTags`, `healthCheck` only; chat, marking and plan generation need a text-generation capability. Working assumption: PC-5 adds `generateText({purpose, system, input})` returning `{text, tokensIn, tokensOut}` to the adapter interface and the `mock` adapter; `AdapterCikguAi` calls it; until it exists BE-43 ships with `MockCikguAi` only and the PR says so. Also: the prompts, the output format for marks, and validation of a real model's marks (an integer from 0 to the rubric maximum) are not defined by the mock; they are written only when the lead supplies them.
2. BE-36's redaction masks names and contact details and forbids user/student identifiers in a request, but marking needs the essay text (which may contain a child's name). Working assumption: the student name field is never sent; the essay body goes through the redaction step; the lead confirms this is acceptable (BE-NFR-31 to BE-NFR-36).
3. The mock has no AI failure path. Working assumption: provider error, rate limit or `AI_BUDGET_EXHAUSTED` returns 503 with raw body `{"error": "AI_UNAVAILABLE"}` on `send` and 503 `AI_UNAVAILABLE` in the standard envelope on `POST /api/cikgu/rph`; no BM message exists, the client fallback text is used. Confirm the code and the copy.
4. The mock thread id is `thr-<n>`; v2 ids are decimal strings (UD-1). Working assumption: `thread_id` is the bigint id as a decimal string and the client treats it as opaque (verified against `chat-lib.ts` and the client); a non-numeric string is "unknown" and starts a new thread.
5. The role-access matrix lists "Cikgu Alesa" for Murid only; the mock lets every signed-in role chat and lets teacher and admin use the tools. Working assumption: replicate the mock guards (S and T) and make no change; the lead decides whether the teacher tools stay reachable from the Guru portal.
6. Whether .cloud `chatbot_conversations`/`chatbot_messages` (anonymous visitors, ratings) are ever loaded, and whether anonymous threads need a nullable `user_id` (v2-data-migration line 317). Working assumption: not migrated, `user_id` stays required.
7. The mock waits 1,500 ms before answering `send` and `POST /api/cikgu/rph` (BR-M13-22, so busy states are visible). Working assumption: no artificial delay in the real API; a real provider is slow enough.
8. The SP labels per subject (`Kimia` 5.1.1, `Sejarah` 1.1.1, others 1.1.1) are illustrative in the mock, not DSKP data. Working assumption: replicate them as a constant in the contract; the lead supplies a real mapping later.
9. `is_test` (G-07): writes by an admin in Mod Pelajar are stamped on all five tables. Working assumption: owner-only lists, the quota count and the CSV include the caller's own rows whatever the stamp (the data are personal to the owner); aggregates and migration counts exclude them.
10. Seed content: a handful of fictitious rows (the mock seed has 2 RPHs, 2 essays and 9 pending tags with person names from the M01/M08 seeds). Working assumption: the seed creates 2 RPHs, 1 essay and a few pending tags for a seeded teacher and seeded students resolved by natural key, with new fictitious names; do not copy names from the mock seed.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-43 (cikgu-alesa). Work in this repo clone on branch be/BE-43-cikgu-alesa, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for the AI adapter); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-36-ai-extraction-service.md; docs/plan/backend-tasks/BE-43-cikgu-alesa.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/cikgu/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, repository, typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Reproduce the un-enveloped bodies of POST /api/cikgu/send (200, 401 {}, 422 {}, 429 {quota_exhausted:true}) exactly and the exact BM texts. No AI vendor SDK, key or HTTP call in this module: the reply, marks and plan text come from CikguAiPort, whose mock implementation is the canned logic of canned.ts and whose real implementation calls the BE-36 adapter only. Never commit secrets, real personal names or the mock seed names. Do not edit src/**, e2e/**, docs/TRACKER.md, ai-extraction/** or the contract common/session/auth/access folders. Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-43. Port the five mock stores to Prisma, implement the 10 routes with the mock's quota, routing, validation, roll-up, approval and CSV rules, make the daily quota race-safe, and put the AI behind CikguAiPort with the mock provider as the acceptance baseline.
```
