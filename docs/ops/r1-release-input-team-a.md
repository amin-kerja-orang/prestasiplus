# R1 release-notes input from team A (H-A24)

For B1's T24 (`docs/ops/r1-release-notes.md`). Date: 2026-10-31. Branch `r1/ha24-release-input`. First written at a6ff0c0d (BASE-21); state column and rollback text refreshed against BASE-60 (`a3e92b06`) after B2's review. Docs only; nothing was run in this unit.

How to read the state column:

- **BASE-n** = merged into `feature/v3-bijak-r1` (MERGE-LOG on `origin/team/r1-board`).
- **READY** = a team A branch at the head shown, not in base. Where B2 has asked for changes the cell says so (**CHANGES-REQUESTED**). The merge order is the lead's and B1's call (C-POLICY-2 on the board branch and MERGE-LOG); "depends on" below is only what the code needs.
- Command SQL for 0092 to 0105 is in `docs/ops/r1-runbook.md` (branch `r1/t37-r1-runbook` @ 80101199, READY; sections 2 and 3). This page adds the per-unit view and the units that came after the runbook was first written.
- Names only, no secret values.

## 1. Migrations 0100 to 0105

Apply with `prisma migrate deploy`, in number order, together with the API/FE build that carries the same units. The folders are independent of each other except for the order of numbers; if a unit is not in the release, skip only that folder (a later number must never be applied before an earlier pending one is accounted for).

| # | Folder | Unit, branch @ head | State | What it does | Reversible? | Rollback | Depends on |
|---|---|---|---|---|---|---|---|
| 0100 | `0100_question_lifecycle_approved` | T04 `r1/b01-lifecycle` @ 3cbc9092 | **BASE-4** | Approved = servable. Old `approved` becomes `review`, old `published` becomes `approved`; status CHECK `draft, review, approved, archived`; partial indexes rebuilt on `'approved'`. One transaction. | **No** | Restore the pre-migration dump with the previous API/FE build (release notes 6.2). After a restore do **not** run `prisma migrate resolve`: the restored `_prisma_migrations` has no 0100 row (P3011). | none; `VACUUM ANALYZE question_versions;` right after |
| 0101 | `0101_essay_choice` | T25 `r1/t25-essay-choice-store` @ e14f4f91 | **BASE-15** | Adds `essay_choice` to the `question_parts.mode` CHECK, nullable `question_parts.topics` jsonb, `ck_question_parts_topics` (2 to 6 topics, only on an `essay_choice` leaf). Additive. | Yes, after deleting `essay_choice` parts | Reverse SQL from the file header, then **delete this migration's row from `_prisma_migrations`** (release notes 6.3). `migrate resolve --rolled-back` is only for a FAILED migration (`finished_at` NULL; P3012 otherwise). | T08 merged (BASE-10); no data link |
| 0102 | `0102_leaf_cognitive_level` | T33 `r1/t33-leaf-tags` @ 95cea5be | **BASE-27** | Adds nullable `question_parts.cognitive_level` with `ck_question_parts_cognitive_level` (mengingat, memahami, mengaplikasi, menganalisis, menilai, mencipta) and `ck_question_parts_cognitive_level_leaf_only` (a part without a mode has none). No backfill. | Yes | Header SQL: drop the two constraints, then the column; then delete the `0102_leaf_cognitive_level` row from `_prisma_migrations` (release notes 6.3; not `--rolled-back`, P3012) | T29 and T32 (T32 is in base) |
| 0103 | `0103_question_report_context` | T42 part 1 `r1/t42-reports-intake-acs` @ d1210e96 (A2) | **BASE-41** | Adds nullable `question_reports.paper_id` (bigint) and `paper_label` (text, CHECK at most 200 chars), FK `fk_question_reports_paper_id` to `papers` (ON DELETE SET NULL), FK `fk_question_reports_attempt_id` to `exam_attempts` (**NOT VALID**: old rows are not checked, new and updated rows are), index `ix_question_reports_paper_id`. Existing rows keep NULL. | Yes | Header SQL: drop the index, the two FKs, the CHECK, then the two columns; then delete the `0103_question_report_context` row from `_prisma_migrations` (release notes 6.3; not `--rolled-back`, P3012) | T35 (in base) for the Arkib flow; no data dependency |
| 0104 | `0104_paper_section_admin_created` | T48 `r1/t48-builder-parity` (A3; B2 Approve with Minors, B3 Pass; head quoted in the B2 board, it moves when BASE merges; the table rows that name a SHA are updated by the lead at merge) | **not in base; B2 Approve with Minors (cycle 16), B3 Pass; A3 closing the Minors** | Adds `paper_sections.admin_created boolean NOT NULL DEFAULT false`: false for every Bahagian that comes from the Kontrak (all existing rows), true for one an admin adds in Semak Kertas ("Tambah bahagian"); only such a Bahagian takes "Tambah soalan". Constant default, additive. | Yes | Header SQL: `ALTER TABLE "paper_sections" DROP COLUMN "admin_created"`; then delete the `0104_paper_section_admin_created` row from `_prisma_migrations` (release notes 6.3; not `--rolled-back`, P3012) | T34 (builder routes); T48 does not contain T33 or T42, so 0102 and 0103 are independent of it |
| 0105 | `0105_gate_facts` | H-A18 `r1/ha18-gate-facts` @ d3842c48 (A2; the commits after 3a2ac810 change docs only, `prisma/` is identical, so the run below stands) | **not in base; pushed, review not seen (unconfirmed)**; SQL and backfill **run** (below) | Adds `question_versions.last_editor` (text, `person` default, CHECK `person`/`ai`) and `declared_marks` (smallint, nullable, CHECK >= 0). Backfill in one DO block: `last_editor = 'ai'` only for `ai_variant` questions whose draft/review version has no status event made by a person; `declared_marks` from `intake_items.payload->>'marks'` when it is a whole number 0..999 (the migration prints both counts as a NOTICE). The approve gate then reads real facts (a version last written by the AI is refused; declared marks must equal the leaf sum). Already-approved questions are not re-checked. | Yes | Header SQL: drop the two CHECKs, then the two columns; then delete the `0105_gate_facts` row from `_prisma_migrations` (release notes 6.3; not `--rolled-back`, P3012) | T33 (gate); no data dependency |

Notes:

- No other team A branch carries a migration folder (checked again against the `r1/*` heads at BASE-62: `r1/t48-builder-parity` carries 0104 and `r1/ha18-gate-facts` carries 0105; the 0105 migration and its SQL were run on a local database, section 1.1). T44 (Kontrak "Boleh tanda auto") uses `blueprints.auto_markable`, which already exists. Migration numbers: 0105 = A2 H-A18 (`r1/ha18-gate-facts`, pushed); 0106 to 0109 free (the R2 pool-tag drop was planned as 0107 but is deferred); 0120 to 0129 is team A's overflow range.
- The runbook's section 2.1 names 0101 and 0102 for T25 and T33; keep the same order. 0103 is now in it too (branch `r1/t37-r1-runbook` @ 80101199: list row, before/after SELECTs in 3.1 and 3.5b, history SELECT, and the note not to run `VALIDATE CONSTRAINT` in the release).
- Statistics: only 0100 needs `VACUUM ANALYZE question_versions;` (runtime on the production-size table not measured).
- The NOT VALID foreign key on `attempt_id` stays NOT VALID. Do not run `VALIDATE CONSTRAINT` as part of the release; old rows have `attempt_id` values that nothing ever checked.

### 1.1 Verification SELECTs

**Ran on local migrated DB (BASE-62 `17797f48` + 0104 @ `2cbe7d28` (T48) + 0105 @ `3a2ac810` (H-A18), demo seed), 20/20 ok for the statements below, and 74/74 ok for the whole runbook** (`r1-runbook.md` section 9, branch `r1/t37-r1-runbook` @ 80101199: 20 "before" statements on staged databases at 0091 and 0093, 53 "after" statements on the full database, and the 0105 reverse SQL in a rolled-back transaction). The "before" statements below were run here on the migrated database, so for those they prove syntax only; the runbook ran them on staged databases, and the 0105 predictions were also run with real rows (second bullet from the end). Throwaway Postgres 16 container, removed afterwards. 0104 and 0105 are read from the T48 and H-A18 branches, not from base. Notable results:

- `question_reports`: 0 rows before and after; `paper_id` bigint and `paper_label` text exist; `ck_question_reports_paper_label` and `fk_question_reports_paper_id` are validated, `fk_question_reports_attempt_id` has `convalidated = f` (NOT VALID, as designed); `ix_question_reports_paper_id` exists.
- 0104: `paper_sections.admin_created` is boolean, NOT NULL, default false; all 9 seeded sections are false and none is admin-added. Re-applying the 0104 statement over those 9 existing rows in a rolled-back transaction gave one row, `false`, count 9; the header reverse SQL then dropped the column cleanly.
- `cognitive_level` exists (text) with its two CHECKs; all 1277 parts are NULL right after the migration.
- Demo data: `approved` 1268, no `published`, servable 1268, login count 493.
- 0105 (**run**): `question_versions.last_editor` (text, NOT NULL, default `person`) and `declared_marks` (smallint, nullable) exist, both CHECKs validated; on the seeded data every version is `person`, `declared_marks` is NULL everywhere and no approved or archived row is `ai` (the demo seed has no `ai_variant` question and no intake item, so both predictions were 0).
- 0105 backfill with real rows (on a copy with synthetic rows: a draft `ai_variant` with no human event, a review `ai_variant` with a human event, an approved `ai_variant`, intake items with marks 4, `"5"` and 1000): predictions 1 and 1, file NOTICE `0105 backfill: last_editor=ai on 1 versions, declared_marks set on 1 versions`, after the migration `ai` 1, `person` 1270, `declared_marks` 1, `approved_or_archived_ai` 0.
- 0105 rollback as a procedure (on a copy): header reverse SQL, then `DELETE FROM _prisma_migrations WHERE migration_name = '0105_gate_facts'`; `prisma migrate status` then showed 0105 as not yet applied and `prisma migrate deploy` applied it again. `--rolled-back` was not used (finished migration, P3012). Under `prisma migrate deploy` the NOTICE was not seen in the output tail that was kept (unconfirmed whether Prisma prints it), so the counts are the check.
- The reverse SQL in the 0102, 0103 and 0104 file headers was run in a rolled-back transaction in the earlier pass: it drops the objects cleanly (the 0104 file changed only a comment since).
- Not covered by a run: the "later, after pupils report" SELECT returns 0 rows only because no report exists; it proves syntax, not the API write.

```sql
-- before 0103: record the report table (nothing wrote attempt_id before)
SELECT count(*) AS reports, count(attempt_id) AS with_attempt FROM question_reports;

-- after 0103
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name = 'question_reports' AND column_name IN ('paper_id', 'paper_label');                 -- 2 rows
SELECT conname, convalidated FROM pg_constraint
 WHERE conrelid = 'question_reports'::regclass
   AND conname IN ('ck_question_reports_paper_label', 'fk_question_reports_paper_id', 'fk_question_reports_attempt_id');   -- 3 rows; attempt FK convalidated = false
SELECT indexname FROM pg_indexes WHERE indexname = 'ix_question_reports_paper_id';                       -- 1 row
SELECT count(*) AS reports, count(paper_id) AS with_paper FROM question_reports;                         -- same total as before, with_paper 0

-- later, after pupils report from a sitting: the paper comes from the attempt
SELECT r.id, r.attempt_id, r.paper_id, r.paper_label FROM question_reports r WHERE r.attempt_id IS NOT NULL AND r.paper_id IS NULL LIMIT 20;   -- 0 rows once the API writes both

-- before 0104: no admin_created column yet
SELECT column_name FROM information_schema.columns WHERE table_name = 'paper_sections' AND column_name = 'admin_created';   -- 0 rows
SELECT count(*) AS sections FROM paper_sections;                                                                          -- record

-- after 0104: boolean, NOT NULL, default false; every existing section is false, none admin-added
SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
 WHERE table_name = 'paper_sections' AND column_name = 'admin_created';                                                   -- boolean, NO, false
SELECT admin_created, count(*) FROM paper_sections GROUP BY admin_created ORDER BY admin_created;                          -- one row, false, = sections
SELECT count(*) AS admin_added FROM paper_sections WHERE admin_created;                                                    -- 0

-- before 0105: neither column exists; two predictions for the backfill NOTICE
SELECT column_name FROM information_schema.columns WHERE table_name = 'question_versions' AND column_name IN ('last_editor', 'declared_marks');   -- 0 rows
SELECT count(*) AS will_be_ai FROM question_versions v
 WHERE v.status IN ('draft', 'review')
   AND EXISTS (SELECT 1 FROM questions q WHERE q.id = v.question_id AND q.source_type = 'ai_variant')
   AND NOT EXISTS (SELECT 1 FROM question_status_events e
                    WHERE e.question_id = v.question_id AND e.version_no = v.version_no
                      AND e.from_status IS NOT NULL AND e.actor_user_id IS NOT NULL);                                          -- record
SELECT count(*) AS will_have_declared_marks FROM question_versions v JOIN intake_items i ON v.intake_item_id = i.id
 WHERE jsonb_typeof(i.payload->'marks') = 'number' AND (i.payload->>'marks') ~ '^[0-9]{1,3}$';                                -- record

-- after 0105: both columns, both CHECKs validated, counts equal the predictions, no approved/archived row is 'ai'
SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
 WHERE table_name = 'question_versions' AND column_name IN ('last_editor', 'declared_marks') ORDER BY column_name;                -- 2 rows
SELECT conname, convalidated FROM pg_constraint
 WHERE conrelid = 'question_versions'::regclass AND conname IN ('ck_question_versions_last_editor', 'ck_question_versions_declared_marks') ORDER BY conname;   -- 2 rows, validated
SELECT last_editor, count(*) FROM question_versions GROUP BY last_editor ORDER BY last_editor;                                  -- 'ai' = will_be_ai
SELECT count(*) AS with_declared_marks FROM question_versions WHERE declared_marks IS NOT NULL;                                 -- = will_have_declared_marks
SELECT count(*) AS approved_or_archived_ai FROM question_versions WHERE status IN ('approved', 'archived') AND last_editor = 'ai';   -- 0

-- history, all six
SELECT migration_name, finished_at FROM _prisma_migrations
 WHERE migration_name IN ('0100_question_lifecycle_approved', '0101_essay_choice', '0102_leaf_cognitive_level', '0103_question_report_context', '0104_paper_section_admin_created', '0105_gate_facts')
 ORDER BY started_at;
```

## 2. Environment

Set on the API service before it starts. No secret goes in the repo.

| Variable | Unit, branch @ head | State | Default | Read in | Production guidance |
|---|---|---|---|---|---|
| `THROTTLE_SERVABILITY_READ_PER_MINUTE` | T30 `r1/t30-servability-reads` @ 409df4bf | **BASE-28** | 120 per user per minute when unset; integer, minimum 1 | `apps/api/src/common/config/env.schema.ts`; used by `apps/api/src/modules/questions/http/servability.controller.ts` (rate limit of the single, batch, lane reads); listed in `.env.api.example` | Leave unset (default). Raise only if Admin Pusat sees 429 on "Dilihat murid di" or the lanes. |
| `THROTTLE_SERVABILITY_OVERVIEW_PER_MINUTE` | T30 @ 409df4bf (added after the first T30 head f2eeec7d) | **BASE-28** | 6 per user per minute when unset; integer, minimum 1 | same two files | Leave unset. The overview counts the whole bank and has its own bucket. |
| `SERVABILITY_OVERVIEW_WARM` | REQ-B-022(a) `r1/req-b-022a-a4` (REQ-B-053: empty counts as unset) | **not in base** | unset = on in production, off elsewhere; `true` or `false`; an empty value (as in `.env.api.example`) counts as unset | `apps/api/src/common/config/env.schema.ts`; read at start by `apps/api/src/modules/questions/serving/overview-warmer.ts`; listed in `.env.api.example` | Leave unset. Production computes the admin servability overview once at start (not awaited; a failure only logs) so the first admin does not wait on a large bank. Set `false` to turn the warm-up off. |
| `E2E_SEED` | T26 `r1/t26-e2e-seed` @ d474227d; compose wiring in `r1/b1-e2e-off-poc` @ b209b4ff | **BASE-24**, **BASE-25** | unset = off | only `apps/api/prisma/seed/e2e.ts` (`E2E_FLAG`): the module runs only with `--profile=e2e` and `E2E_SEED=1` or `true`, and refuses when the demo guard counts the run as production | **Must be unset on UAT and production.** It creates a pupil, an Admin Pusat and a seed-verified blueprint. D95: UAT gets blueprints through Kontrak and Sahkan, no seed. `compose.http.yaml` sets it inline on the migrate command only (local/e2e stack). |
| `BIJAK_POC_QUESTIONS` | T36 `r1/t36-remove-poc` @ 64ebb379 | **not in base; READY, B2 verdict pending** (earlier CHANGES-REQUESTED, REQ-B-029; A2 pushed a fix) (deprecated, see below) | schema default `false` | `apps/api/src/common/config/env.schema.ts`; one warning in `bijak/integration/integration.module.ts` | `false` or removed. Nothing reads it for behaviour after T36. |

No unit other than these adds or changes an environment variable. I checked every `r1/*` branch's diff of `env.schema.ts` and `.env.api.example`. T33's ops note says so for itself.

### 2.1 BIJAK_POC_QUESTIONS (deprecated no-op, T36)

After T36 the question bank is the only source for Bijak papers, attempts, Jana Kertas, Kuiz and the paper builder. `true` only logs a warning at start. Seeded PoC papers (ids 2 to 4) stay in the database but cannot be started (403 "not eligible"); Jana Kertas has no PoC pool (422 SHORTAGE). Text for the notes comes from A2's status ("T36 release-note input").

Deploy-config lines (from A2's board row, B3's info, and the T36 head):

| File:line | Value on T36 head | Action |
|---|---|---|
| `compose.http.yaml:31` | `'true'` | `'false'`; done on `r1/b1-e2e-off-poc` (line 54 there). Local/e2e stack |
| `.github/workflows/e2e-http.yml:74` | sed sets `true` | remove the sed; done on `b1-e2e-off-poc` (bank demo paper looked up as `BIJAK_PAPER_ID`) |
| `.github/workflows/frontend.yml:102` | `'true'` | `'false'`; done on `b1-e2e-off-poc` (line 106) |
| `render.yaml:27` | `{ key: BIJAK_POC_QUESTIONS, value: 'true' }` | removed on `r1/t36-remove-poc` @ 64ebb379 (the diff against base deletes the line); not in base yet |
| `deploy/demo/redeploy-demo-migration-aware.sh:676-678` | requires Render value `true` ("else the PoC papers have no questions") | changed on `r1/t36-remove-poc` @ 64ebb379 (read in the diff: the "must be true" stop is replaced by a read-only count of published papers whose questions are all in the bank; zero is a warning, not a stop; see `docs/ops/r1-b07-remove-poc.md`); not in base yet |
| `deploy/vps/compose.prod.yaml:77`, `:113` | `'false'` | already correct |
| `deploy/vps/deploy.sh:115,120,275`, `deploy/vps/api.env.example:5` | forced `false` | already correct |
| `compose.http.yaml:7` (comment) | says `BIJAK_POC_QUESTIONS=true` | comment updated on `b1-e2e-off-poc` |
| `.env.api.example:76` | `BIJAK_POC_QUESTIONS=false   # DEPRECATED NO-OP` | done on T36 |
| `apps/api/prisma/seed/exam.ts:178` | stale warning text | cosmetic, A2/A4 |

Order: `b1-e2e-off-poc` (REQ-A-001) before T36. The e2e specs that need a playable structured paper (`e2e/api/bijak-part-input.spec.ts`) stay open as REQ-B-003.

## 3. Units, routes, visible changes and checks

Columns: **Visible** = what an admin or pupil sees change; **Check** = a read-only SELECT or API probe. SELECTs not marked as run were written from the schema and not executed.

### 3.1 Merged in base (team A)

The BASE column is the MERGE-LOG number. Rows from BASE-24 onward were READY in the first version of this page.

| Unit | Branch @ head | BASE | Depends on | New routes / contract | Visible change | Check |
|---|---|---|---|---|---|---|
| T04 lifecycle + D91 counts | `r1/b01-lifecycle` @ 3cbc9092 | BASE-4 | T03 | none (status values change) | Admin "Lulus/Terbitkan" makes a question **approved** and it is served at once in Databank, Latih Tubi SPM, Bab, Jana, Kuiz. Cards show what the surface can draw (50 / 53 style gaps close). | runbook 3.3 and 3.6 (login count 493 on the demo data) |
| T03 bridge (b08) | `r1/b08-bridge` @ 7050f2d7 | BASE-3 | T01 | image read rule, `ix_part_options_image_file_id` (0093) | A question with an option or stem picture can be served to Bijak | runbook 3.2 |
| T07 model gaps | `r1/t07-model-gaps` @ b0421c6b | BASE-9 | T03 | 7 stimulus kinds + caption, table, source on question reads; `essay_choice` in the parts contract; groups always emitted (D90) | Passage, image, diagram, table, map, infographic, graph all reach the builder and Kuiz; shared stimulus = one group | none (read shape) |
| T08 secondary-only guard | `r1/t08-secondary-guard` @ 7a3f754c | BASE-10 | T07 | none | Darjah (D1 to D6) questions never enter Bijak or builder paths (D72) | `secondary-only-bijak` spec |
| T27 Darjah refusal | `r1/t27-darjah-refusal` @ 3cf53190 | BASE-8 | none | none | Creating a question with a Darjah level is refused with a BM message; blueprints already refuse | spec `primary-level-refused` |
| H-A2 / H-A11 | `r1/ha2-reports-darjah` @ 38d57846, `r1/ha11-school-scope` @ 91432622 | BASE-12, BASE-7 | none | none | Class counts, teacher stats and class reports leave out the hidden Darjah population; school scope confirmed (not a leak) | specs only |
| T25 essay_choice | `r1/t25-essay-choice-store` @ e14f4f91 | BASE-15 | T08 | 0101; `topics` on a part | Admin can store an essay with 2 to 6 topics; the pupil picks one | runbook 3.4 |
| H-A7 | `r1/ha7-essay-choice-flat-view` @ d7424ace | BASE-16 | T25 | `essayTopics` on flat question rows (additive) | Admin lists can show "Esei pilihan" with topics (needs H-C3 FE) | none |
| T28 rewards | `r1/t28-bijak-rewards` @ 54c17c4d | BASE-11 | none | none | Bijak submit also credits XP and the streak (kombo), once per attempt; Cuba Lagi earns again per attempt (D93, second part); Mod Pelajar earns nothing | `SELECT source, description, count(*) FROM coin_ledger WHERE source = 'quiz_spm' GROUP BY 1, 2;` (ledger source of a Bijak paper) |
| T06 Jana standard | `r1/t06-jana-standard` @ 4349bb00 | BASE-17 | T08 | `POST /api/bijak/papers/generate` now composes the standard paper | Jana Kertas gives exactly the blueprint or refuses: 422 SHORTAGE, 503 GENERATE_LIMIT, no row on refusal; pupils need a **Disahkan** blueprint (D75, D76) | runbook 5.4 |
| R1E2E-01 | `r1/e2e01-intake-subject` @ dbf524de | BASE-13 | none | none | Matematik and Sains intake items are no longer refused with "Subjek dan tingkatan perlu ditetapkan." | `source_papers.subject_id` not NULL on new MAT batches |
| T32 stimulus API | `r1/t32-stimulus-api` @ 87a9a363 | BASE-14 | T04, T07 | `POST/GET/PUT/DELETE /api/stimuli[/:id]`; `POST /api/stimulus-groups`, `GET/PUT/DELETE /:id`, members add/remove/reorder/atomic set, `POST /:id/questions` | Studio can build one stimulus with 2 or more members. D93 first part: a draft group may have 0 or 1 member (warning until 2). A served group or stimulus is locked: 409 `groupServed` / `memberServed` / `stimulusServed` | none |
| T35 Arkib | `r1/t35-report-archive` @ 4ea790b1 | BASE-18 | T04 | `PATCH /api/question-reports/:id { archive }` | "Arkib" on a report archives the question for real (status event); it leaves Latih Tubi SPM and new Jana pools; started sittings keep their version | `SELECT status, count(*) FROM question_versions GROUP BY 1;` before and after |
| T05 / minors | `r1/t05-db-specs` @ 37770b77, `r1/t05-minors` @ 99dd5fef | BASE-5, BASE-19 | T04 | none | none (specs; counts BM 50, MATH 54, SCI 50, login 493 pinned on the demo data) | runbook 3.6 |
| T26 E2E seed | `r1/t26-e2e-seed` @ d474227d | BASE-24 | none | none (seed profile `e2e`) | Local only: T4 pupil, Admin Pusat, launch blueprint 3472/2 Disahkan through the real Sahkan checks. Refused in production | On UAT: `seeded_launch_blueprints` and `seeded_study_evidence` must be 0 (runbook 5.4, 8) |
| CI off PoC | `r1/b1-e2e-off-poc` @ b209b4ff | BASE-25 | T26 | none | none for users | see 2.1 |
| T29 servability | `r1/t29-servability` @ c53e655d | BASE-26 | T03, T04 | none (service + `servability/` contract; 25 reason codes, BM copy in one table) | none alone | spec `servability-parity` |
| T30 servability reads | `r1/t30-servability-reads` @ 409df4bf (contains R1E2E-05b 9895d004 and servability-own-stimuli eea90859) | BASE-28 | T29 | `GET /api/admin/servability/questions/:id`, `POST /questions/batch` (up to 100), `GET /overview`, `GET /lanes/databank`, `GET /lanes/bijak-spm`; Admin Pusat only, CSRF on the batch, rate limits in section 2 | Admin sees "Dilihat murid di" per question and activity with the reason; an archived question on a Terbit paper is shown as not served | overview takes about 2 s on a 5k bank in the unit's own measure; on the 400k bank H-A21 measured 22.5 s before the cache |
| T33 DSKP gate | `r1/t33-leaf-tags` @ 95cea5be | BASE-27 | T29, T32 | `GET /api/questions/:id/gate-check?gate=approve|submit`, `POST /api/questions/:id/status { to, reason? }`; `dskpStatus` and `dskpComplete` on reads; `cognitiveLevel` per leaf; 0102 | A new approval of an SPM Tingkatan 4 or 5 question needs unit, SP, TP, kertas and a cognitive level on every leaf ("Bahagian (b) belum ada aras pemikiran.", "Sila pilih kertas untuk soalan SPM."). Bulk approve and create-as-approved use the same gate; refused rows come back in `failed[]`. Already-approved untagged legacy questions stay served (D80 DEC-2) |
| T47 bank parity | `r1/t47-bank-parity` @ b551c679 | BASE-33 | T33 | `POST /api/questions/bulk-action/filter` (expectedCount, cap 500) | Studio list filters Tahun, Negeri, Kertas, Jenis; "Luluskan Hasil Tapisan" / "Arkib Semua"; illegal move reads "Peralihan '{from}' -> '{to}' tidak dibenarkan." (V2 wording). A 500-row filter bulk can stall; noted in the unit's ops text | dry run with a filter that matches under 500 rows |
| T48a paper list | `r1/t48a-paper-list` @ e5041595 | BASE-34 | none | paper list filters Subjek and Cari; paper title at most 200 characters on create and update | Admin filters the Pembina Kertas list; a longer title is 422 "Tajuk kertas tidak boleh melebihi 200 aksara." [PROPOSED] | pre-check: `SELECT id, length(title) FROM papers WHERE length(title) > 200 LIMIT 20;` (expect 0 rows) |
| R1E2E-05 / 05b | `r1/e2e05b-own-stimuli` @ 9895d004 (merged inside T30, BASE-28) | BASE-28 | T07 | optional `stimuli[]` on the attempt question | A paper with an image question can start (it gave Mula 403); a question's own stimuli of any kind show inline; a shared stimulus without a group stays refused (D90) | probe: start a paper holding an image MCQ |
| servability-own-stimuli | `r1/servability-own-stimuli` @ eea90859 (merged inside T30, BASE-28; B2 verdict on it was pending when merged) | BASE-28 | T29, 05b | none | The servability verdict equals what the bridge serves | spec |
| T42 part 1 | `r1/t42-reports-intake-acs` @ d1210e96 | BASE-41 | T35 | `attemptId` and `paperId` on `POST /api/question-reports`; `paper { id, label, attemptId }` on admin report reads; 0103; 422 "Rujukan percubaan tidak sah." [PROPOSED], "Soalan ini bukan sebahagian daripada percubaan itu." [PROPOSED], "Kertas tidak sepadan dengan percubaan itu." [PROPOSED] | A pupil's report from a sitting names the paper; the admin queue shows it | section 1.1 |

Also merged since BASE-21, not described row by row in this page (see MERGE-LOG on `origin/team/r1-board`): REQ-B-010/012/015 (BASE-31), T49 stimulus lists (BASE-32), REQ-B-018/020 (BASE-35), REQ-B-021 (BASE-36), REQ-B-008 (BASE-38), REQ-B-005/006/007/014a (BASE-39), T41 specs (BASE-40), T53 specs (BASE-42), REQ-A-010 (BASE-50). Their deploy effect was not re-derived here (unconfirmed); read the MERGE-LOG line for each.


### 3.2 READY, not in base

State is from the board (BOARD.md and B2's status) at BASE-60. READY units whose heads are not in base can still move; the head shown is what `git ls-remote` returned when this page was refreshed.

| Unit | Branch @ head | State | Depends on | New routes / contract | Visible change | Check |
|---|---|---|---|---|---|---|
| H-A21 overview cache | `r1/ha21-overview-cache` @ a255028e | READY (chain after T45 part 1; A4 posts one tip) | T30 | `computedAt` on the overview | Overview is cached 5 minutes, stale-while-revalidate, single flight, invalidated on question events and a papers fingerprint. No env var | warm p95 target under 500 ms (unit's claim, not re-measured here) |
| H-A18 gate facts | `r1/ha18-gate-facts` @ d3842c48 | pushed, review not seen (unconfirmed) | T33 | 0105; none else read from the diff | The approve/submit gate uses real facts for duplicate flag, media, source declaration, AI-last-editor and declared marks instead of always-satisfied defaults, so some approvals that passed before now get refused (new approvals only; approved questions are not re-checked) | the 0105 NOTICE counts (`last_editor=ai`, `declared_marks`) at migrate time; `SELECT last_editor, count(*) FROM question_versions GROUP BY 1;` (run, section 1.1) |
| T26c e2e K2 fixture | `r1/t26c-e2e-k2` @ df8a52a5 | READY (A1; B2 verdict not seen) | T26b | none | Local/E2E seed only (never a server): a structured Kertas 2 question pool and a published paper for 3472/2, so `bijak-part-input` has a playable paper after T36. Merge order T26b -> T26c -> T36 | none on UAT: `seeded_launch_blueprints` stays 0 (runbook 5.4) |
| REQ-B-031 report guard | `r1/reqb031-report-guard` @ 8e913fb5 | READY (A1; review not seen, unconfirmed) | none | `POST /api/question-reports` rules (D98, per the board decision; implementation not re-read here) | A pupil reports only a question held by their own attempt or practice session; a report does not deactivate a question by itself (admin triage in Laporan Soalan); a re-POST never undoes an admin dismiss; a per-pupil daily cap of 20 | `SELECT status, count(*) FROM question_reports GROUP BY 1;` (written from the schema, not run) |
| REQ-C-019 joinable filter | `r1/t49-served-now` @ 2e6d06df | READY (A2; review not seen, unconfirmed) | T49 (base) | `joinable` filter on the stimulus group list and on `GET /api/questions/filter-options` (from the commit message; not re-read) | Studio can list groups a question can still join | none |
| REQ-C-009 / 010 / 013 | `r1/c-requests-a2` @ 60e301d6 | READY (A2; review not seen, unconfirmed) | none | batch list rows carry `itemCount` and `reviewedCount`; admin question list rows carry `kertas` and `numberLabel`; Arkib needs no reason and `review -> archived` joins the transition table (Admin Pusat) (from the commit titles; not re-read) | Admin lists show the V2 columns; archiving a question in review is allowed without a reason | none |
| R008-L1 stimulus link guard | `r1/r008-l1` @ 4cd62e5b | READY (A2; needs B2 and B3, per the board) | none | a non-admin may only reference a stimulus the question already carries ("Stimulus tidak sah." per the board; not re-read) | A Guru cannot link an arbitrary stimulus to their own question | spec `stimulus-link-guard.spec.ts` |
| t45-lanes | `r1/t45-lanes` @ ced5ea31 | READY (same chain) | T30 | same lane routes, V2 hub order and wording | Kandungan SPM hub cards in V2 order; Bijak SPM card counts paper rows | none |
| T45 part 1 | `r1/t45-servability-acs` @ 8eba44c0 | **CHANGES-REQUESTED** (A4) | T29 | none | Terbitkan on a question that no activity can serve is refused: "Soalan ini tidak boleh dipaparkan di mana-mana aktiviti murid, jadi belum boleh diterbitkan." [PROPOSED]; paper-level reason line | probe: approve an image question without its image |
| T34 builder review | `r1/t34-builder-review` @ 5bb590d0 | fix pushed (a46a375e) and BASE-63 merged; awaiting B2 re-review (earlier CHANGES-REQUESTED) | T29 (and T33 per B2's order) | `PUT /api/admin/papers/:id/groups/:groupId` (title only), `GET/PUT /api/admin/section-pools/:questionId`, `POST/DELETE /api/admin/papers/:id/placements` (extra question; blocker "Lebih 1 soalan"), `PUT {reference}` with image check, publish body `{ override?, reason? }`, `blockerDetails` + `canOverride` | **Terbit gates:** R1E2E-06 Terbit refuses what the attempt path refuses (not overridable); R1E2E-07 / AC-R1-16.2 Terbit needs a Disahkan blueprint, overridable only with a reason of 5 or more characters and an audit row; D93: "Kumpulan perlu sekurang-kurangnya 2 soalan." blocks Terbit (not overridable); structured blockers with an overridable flag; a Terbit paper is read-only ("Kertas Terbit tidak boleh disunting. Tarik balik dahulu.") | `SELECT created_at, target_id FROM audit_events WHERE action = 'bijak.paper.published_override' ORDER BY created_at DESC LIMIT 20;` |
| T31 builder wire | `r1/t31-builder-wire` @ e64bed5a (contains T34) | **CHANGES-REQUESTED** (needs fixed T34 and REQ-A-008) | T34; blocked on C1 type change (REQ-A-008) | `stimuli[]` (7 kinds, picture URL `/api/files/<token>`) on builder views | Admin builder shows every stimulus of a group | none |
| H-A15 + T44 | `r1/ha15-blueprint-evidence` @ 7e5d637e; `r1/t44-blueprint-fields` @ 072d8f4b (contains it) | H-A15 B3 Pass; T44 **CHANGES-REQUESTED** (A3) | none | Kontrak write schema gains "Boleh tanda auto" (`autoMarkable`); review flag "Blueprint perlu semakan" | **Sahkan:** study-origin evidence no longer counts, only `origin = 'admin'` rows (AC-39.2); a non-blank note is required ("Isi nota pengesahan dahulu.", 422 `fields.note`); skema Markah compares offered marks on choose-N sections (AC-39.7). Blueprints verified before this may fail a new Sahkan until evidence is added | `SELECT origin, count(*) FROM blueprint_evidence GROUP BY 1;` `SELECT code, version, auto_markable FROM blueprints WHERE status = 'active' ORDER BY code;` |
| T48 builder parity | `r1/t48-builder-parity` @ 54f5e0bc (contains T34) | B2-findings fix (2cbe7d28) and BASE-63 merge, awaiting re-review (earlier CHANGES-REQUESTED) (migration 0104) | T34 | 0104; `POST /api/admin/papers/:id/sections`, `POST /api/admin/papers/:id/sections/:sid/questions`, `DELETE /api/admin/papers/:id/questions/:questionId`; editable cover code, per-paper rule and select count, `pinned` per placement, stimulus edit (commit 089aa24b) | Semak Kertas: "Tambah bahagian", "Tambah soalan" (a new question inside the paper, through the approve gate), "Padam soalan", editable "Kod kertas (kulit)"; the Disematkan chip data. Terbit papers stay read-only | `SELECT admin_created, count(*) FROM paper_sections GROUP BY 1;` (section 1.1) |
| H-A13 archived paper | `r1/ha13-archived-paper` @ 61b8851d | B2 Approve w/ Minors; needs base merge and `contract:emit` | T35 | contract text; `npm run contract:emit` needed | Archived question on a Terbit paper: a new sitting is refused ("Kertas ini sedang dikemas kini dan tidak boleh dicuba buat masa ini." [PROPOSED]), the card is hidden except for pupils with an open sitting, Cuba Lagi answers 409 `retryPaperGone`; the Arkib response warns the admin that Terbit papers hold the question | probe on a test paper |
| T42b | `r1/t42b-intake-acs` @ bca92f3d | B2 Approve w/ Minors; A2 merges the base | none | none | An accepted intake figure becomes its own `question_image` file, so pupils can see it (AC-R1-14.3); file storage grows by one file per accepted figure | `SELECT count(*) FROM files WHERE purpose = 'question_image';` before and after (`files.purpose` confirmed in the schema) |
| T45b | `r1/t45b-question-detail-acs` @ 8342f9a0 | **CHANGES-REQUESTED** (A2) | T42 part 1 | question detail lists the papers that place it (`section`, `versionNo`) | Admin sees where a question is used; uploading the missing image releases a held legacy question | none |
| T38 / T40 | `r1/t38-selfmark-reward` @ ff1e8a1b; `r1/t40-attempts-acs` @ 1ef1341b (contains T38) | T38 **CHANGES-REQUESTED** (A1); T40 follows T38 | T28 | none | D94: a self-mark that raises a part's mark credits 2 Syiling and 10 XP per mark gained, once per part and level, never above the part's marks, nothing back for a lower mark, none in Mod Pelajar | ledger rows with source `quiz_spm`; T40 adds specs only |
| T36 | `r1/t36-remove-poc` @ 64ebb379 | READY, B2 verdict pending (earlier CHANGES-REQUESTED, REQ-B-029; A2); merge order T26b -> T26c -> T36 | REQ-A-001 (`b1-e2e-off-poc`), T26 | none | PoC papers not playable; see 2.1 | `SELECT id, title, status FROM papers ORDER BY id LIMIT 10;` and try one PoC paper (403) |
| t04-minors | `r1/t04-minors` @ ec179b12 | **CHANGES-REQUESTED** (docs; A2) | T04 | none | Soalan by Chapter tile counts chaptered, ungrouped, approved questions only (R1E2E-09) | runbook 3.6 |

### 3.3 No deploy effect (test or docs only)

`r1/t39-k1-evidence` @ 1a26f7a6 and `r1/t37-r1-runbook` @ 80101199 (docs), `r1/ha9-pipeline-chain` @ 1024616c, `r1/ha12-conformance` @ e1fa7217, `r1/ha16-table-reader` @ 085dec38 (shared table reader; no behaviour change), `r1/ha8-stale-specs` @ 56b1b6cc, `r1/reqb026-spec-fixture` @ 03e4485d (battle spec fixtures, REQ-B-026), `r1/fix-attempt-image-url` (test-only; BASE-64), `r1/t40-attempts-acs`, `r1/t41-curriculum-acs` @ 067ff3cc (specs; BASE-40). Reading only: T41 is not a deploy item.

## 4. Short text for the release notes

- **Admin, questions:** approval now needs the DSKP tags (T33); Studio gets filters and a filtered bulk action (T47); a stimulus group needs 2 members before Terbit (D93); a served group or stimulus cannot be edited (T32).
- **Admin, papers:** Terbit refuses what pupils cannot sit, and refuses a paper without a Disahkan blueprint unless an Admin Pusat overrides with a reason (audited) (T34); paper title at most 200 characters, paper list filters (T48a).
- **Admin, Kontrak:** "Boleh tanda auto" and "Blueprint perlu semakan" (T44); Sahkan needs a note and counts admin evidence only (H-A15).
- **Admin, Laporan Soalan:** "Arkib" archives the question (T35); reports from a sitting name the paper (T42).
- **Pupil:** approved questions appear in Databank, Latih Tubi SPM and Bab (T04); image and stimulus questions play (R1E2E-05/05b); Cuba Lagi earns rewards per attempt (T28) and a self-mark that raises a mark earns the difference (T38, D94); a paper whose question was archived cannot be started anew (H-A13).
- **Environment:** `THROTTLE_SERVABILITY_READ_PER_MINUTE`, `THROTTLE_SERVABILITY_OVERVIEW_PER_MINUTE` and `SERVABILITY_OVERVIEW_WARM` are optional; `E2E_SEED` must stay unset; `BIJAK_POC_QUESTIONS` is a no-op and should be removed (`render.yaml:27` and the demo redeploy script still say `true`).

## 5. Limits

- Branch heads were read from origin at the time of writing; many moved during the day. Re-check a head before quoting it.
- The 0103 SELECTs were run (section 1.1). The unit checks marked "probe" or written from the schema were not run. The runbook's SELECTs for 0092 to 0102 were run on a local database (its section 9).
- "Visible change" for unmerged units comes from the board rows, commit messages and the contract text on the branch; it was not exercised here.
- Whether the T47 500-row stall and the H-A21 22.5 s to 500 ms figures hold on the production-size bank was not measured here.
