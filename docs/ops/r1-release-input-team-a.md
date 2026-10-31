# R1 release-notes input from team A (H-A24)

For B1's T24 (`docs/ops/r1-release-notes.md`). Date: 2026-10-31. Branch `r1/ha24-release-input`, off `feature/v3-bijak-r1` at a6ff0c0d (BASE-21). Docs only; nothing was run in this unit.

How to read the state column:

- **BASE-n** = merged into `feature/v3-bijak-r1` (MERGE-LOG on `origin/team/r1-board`).
- **READY** = a team A branch at the head shown, not in base. Several heads moved after their last review verdict; the board verdicts are in `docs/qa/r1-e2e-readiness.md`. The merge order is the lead's and B1's call; "depends on" below is only what the code needs.
- Command SQL for 0092 to 0104 is in `docs/ops/r1-runbook.md` (branch `r1/t37-r1-runbook` @ ca2e0f93, READY; sections 2 and 3). This page adds the per-unit view and the units that came after the runbook was first written.
- Names only, no secret values.

## 1. Migrations 0100 to 0104

Apply with `prisma migrate deploy`, in number order, together with the API/FE build that carries the same units. The folders are independent of each other except for the order of numbers; if a unit is not in the release, skip only that folder (a later number must never be applied before an earlier pending one is accounted for).

| # | Folder | Unit, branch @ head | State | What it does | Reversible? | Rollback | Depends on |
|---|---|---|---|---|---|---|---|
| 0100 | `0100_question_lifecycle_approved` | T04 `r1/b01-lifecycle` @ 3cbc9092 | **BASE-4** | Approved = servable. Old `approved` becomes `review`, old `published` becomes `approved`; status CHECK `draft, review, approved, archived`; partial indexes rebuilt on `'approved'`. One transaction. | **No** | Restore the pre-migration dump with the previous API/FE build, then `npx prisma migrate resolve --rolled-back 0100_question_lifecycle_approved`. Never run `resolve` without the restore. | none; `VACUUM ANALYZE question_versions;` right after |
| 0101 | `0101_essay_choice` | T25 `r1/t25-essay-choice-store` @ e14f4f91 | **BASE-15** | Adds `essay_choice` to the `question_parts.mode` CHECK, nullable `question_parts.topics` jsonb, `ck_question_parts_topics` (2 to 6 topics, only on an `essay_choice` leaf). Additive. | Yes, after deleting `essay_choice` parts | Reverse SQL in the file header, then `migrate resolve --rolled-back` | T08 merged (BASE-10); no data link |
| 0102 | `0102_leaf_cognitive_level` | T33 `r1/t33-leaf-tags` @ 95cea5be (also inside T47 as 276a6622) | **READY** | Adds nullable `question_parts.cognitive_level` with `ck_question_parts_cognitive_level` (mengingat, memahami, mengaplikasi, menganalisis, menilai, mencipta) and `ck_question_parts_cognitive_level_leaf_only` (a part without a mode has none). No backfill. | Yes | Header SQL: drop the two constraints, then the column; then `migrate resolve --rolled-back 0102_leaf_cognitive_level` | T29 and T32 (T32 is in base) |
| 0103 | `0103_question_report_context` | T42 part 1 `r1/t42-reports-intake-acs` @ d1210e96 (A2) | **READY** | Adds nullable `question_reports.paper_id` (bigint) and `paper_label` (text, CHECK at most 200 chars), FK `fk_question_reports_paper_id` to `papers` (ON DELETE SET NULL), FK `fk_question_reports_attempt_id` to `exam_attempts` (**NOT VALID**: old rows are not checked, new and updated rows are), index `ix_question_reports_paper_id`. Existing rows keep NULL. | Yes | Header SQL: drop the index, the two FKs, the CHECK, then the two columns; then `migrate resolve --rolled-back 0103_question_report_context` | T35 (in base) for the Arkib flow; no data dependency |
| 0104 | `0104_paper_section_admin_created` | T48 `r1/t48-builder-parity` @ 1b76778f (A3; contains T34 e363fe51 and its follow-up) | **READY** | Adds `paper_sections.admin_created boolean NOT NULL DEFAULT false`: false for every Bahagian that comes from the Kontrak (all existing rows), true for one an admin adds in Semak Kertas ("Tambah bahagian"); only such a Bahagian takes "Tambah soalan". Constant default, additive. | Yes | Header SQL: `ALTER TABLE "paper_sections" DROP COLUMN "admin_created"`; then `migrate resolve --rolled-back 0104_paper_section_admin_created` | T34 (builder routes); T48 does not contain T33 or T42, so 0102 and 0103 are independent of it |

Notes:

- No other team A branch carries a migration folder (checked at the time of writing; `r1/ha18-gate-facts` with 0105 was not on origin). T44 (Kontrak "Boleh tanda auto") uses `blueprints.auto_markable`, which already exists. The numbers 0105 to 0109 stay reserved (0105 for H-A18, 0107 for the R2 pool-tag drop); 0120 to 0129 is team A's overflow range.
- The runbook's section 2.1 names 0101 and 0102 for T25 and T33; keep the same order. 0103 is now in it too (branch `r1/t37-r1-runbook` @ bd2c21e9: list row, before/after SELECTs in 3.1 and 3.5b, history SELECT, and the note not to run `VALIDATE CONSTRAINT` in the release).
- Statistics: only 0100 needs `VACUUM ANALYZE question_versions;` (runtime on the production-size table not measured).
- The NOT VALID foreign key on `attempt_id` stays NOT VALID. Do not run `VALIDATE CONSTRAINT` as part of the release; old rows have `attempt_id` values that nothing ever checked.

### 1.1 Verification SELECTs

**Ran on local migrated DB (BASE-21 `a6ff0c0d` + 0102 @ `95cea5be` (T33) + 0103 @ `d1210e96` (T42) + 0104 @ `1b76778f` (T48), demo seed), 12/12 ok for the statements below (the "before" ones were run on the migrated database, so they prove syntax only; the runbook ran them on staged databases), and 63/63 ok for the whole runbook** (`r1-runbook.md` section 9, branch `r1/t37-r1-runbook` @ ca2e0f93: 16 "before" statements on staged databases at 0091 and 0093, 47 "after" statements on the full database). Throwaway Postgres 16 containers, removed afterwards. 0105 (A2, H-A18) was not on origin when this was run and is not covered. Notable results:

- `question_reports`: 0 rows before and after; `paper_id` bigint and `paper_label` text exist; `ck_question_reports_paper_label` and `fk_question_reports_paper_id` are validated, `fk_question_reports_attempt_id` has `convalidated = f` (NOT VALID, as designed); `ix_question_reports_paper_id` exists.
- 0104: `paper_sections.admin_created` is boolean, NOT NULL, default false; all 9 seeded sections are false and none is admin-added. Re-applying the 0104 statement over those 9 existing rows in a rolled-back transaction gave one row, `false`, count 9; the header reverse SQL then dropped the column cleanly.
- `cognitive_level` exists (text) with its two CHECKs; all 1277 parts are NULL right after the migration.
- Demo data: `approved` 1268, no `published`, servable 1268, login count 493.
- The reverse SQL in the 0102, 0103 and 0104 file headers was run in a rolled-back transaction: it drops all five objects cleanly.
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

-- history, all five
SELECT migration_name, finished_at FROM _prisma_migrations
 WHERE migration_name IN ('0100_question_lifecycle_approved', '0101_essay_choice', '0102_leaf_cognitive_level', '0103_question_report_context', '0104_paper_section_admin_created')
 ORDER BY started_at;
```

## 2. Environment

Set on the API service before it starts. No secret goes in the repo.

| Variable | Unit, branch @ head | State | Default | Read in | Production guidance |
|---|---|---|---|---|---|
| `THROTTLE_SERVABILITY_READ_PER_MINUTE` | T30 `r1/t30-servability-reads` @ 09d53c56 (also in `t45-lanes`, `ha21-overview-cache`) | **READY** | 120 per user per minute when unset; integer, minimum 1 | `apps/api/src/common/config/env.schema.ts`; used by `apps/api/src/modules/questions/http/servability.controller.ts` (rate limit of the single, batch, lane reads); listed in `.env.api.example` | Leave unset (default). Raise only if Admin Pusat sees 429 on "Dilihat murid di" or the lanes. |
| `THROTTLE_SERVABILITY_OVERVIEW_PER_MINUTE` | T30 @ 09d53c56 (added after the first T30 head f2eeec7d) | **READY** | 6 per user per minute when unset; integer, minimum 1 | same two files | Leave unset. The overview counts the whole bank and has its own bucket. |
| `E2E_SEED` | T26 `r1/t26-e2e-seed` @ 0d59f1f8; compose wiring in `r1/b1-e2e-off-poc` @ b209b4ff | **READY** | unset = off | only `apps/api/prisma/seed/e2e.ts` (`E2E_FLAG`): the module runs only with `--profile=e2e` and `E2E_SEED=1` or `true`, and refuses when the demo guard counts the run as production | **Must be unset on UAT and production.** It creates a pupil, an Admin Pusat and a seed-verified blueprint. D95: UAT gets blueprints through Kontrak and Sahkan, no seed. `compose.http.yaml` sets it inline on the migrate command only (local/e2e stack). |
| `BIJAK_POC_QUESTIONS` | T36 `r1/t36-remove-poc` @ 5bc34543 | **READY** (deprecated, see below) | schema default `false` | `apps/api/src/common/config/env.schema.ts`; one warning in `bijak/integration/integration.module.ts` | `false` or removed. Nothing reads it for behaviour after T36. |

No unit other than these adds or changes an environment variable. I checked every `r1/*` branch's diff of `env.schema.ts` and `.env.api.example`. T33's ops note says so for itself.

### 2.1 BIJAK_POC_QUESTIONS (deprecated no-op, T36)

After T36 the question bank is the only source for Bijak papers, attempts, Jana Kertas, Kuiz and the paper builder. `true` only logs a warning at start. Seeded PoC papers (ids 2 to 4) stay in the database but cannot be started (403 "not eligible"); Jana Kertas has no PoC pool (422 SHORTAGE). Text for the notes comes from A2's status ("T36 release-note input").

Deploy-config lines (from A2's board row, B3's info, and the T36 head):

| File:line | Value on T36 head | Action |
|---|---|---|
| `compose.http.yaml:31` | `'true'` | `'false'`; done on `r1/b1-e2e-off-poc` (line 54 there). Local/e2e stack |
| `.github/workflows/e2e-http.yml:74` | sed sets `true` | remove the sed; done on `b1-e2e-off-poc` (bank demo paper looked up as `BIJAK_PAPER_ID`) |
| `.github/workflows/frontend.yml:102` | `'true'` | `'false'`; done on `b1-e2e-off-poc` (line 106) |
| `render.yaml:27` | `{ key: BIJAK_POC_QUESTIONS, value: 'true' }` | **not changed by any branch**: set `false` or remove, for the demo service on Render |
| `deploy/demo/redeploy-demo-migration-aware.sh:676-678` | requires Render value `true` ("else the PoC papers have no questions") | **not changed by any branch**: drop the check; after T36 the demo PoC papers are empty either way |
| `deploy/vps/compose.prod.yaml:77`, `:113` | `'false'` | already correct |
| `deploy/vps/deploy.sh:115,120,275`, `deploy/vps/api.env.example:5` | forced `false` | already correct |
| `compose.http.yaml:7` (comment) | says `BIJAK_POC_QUESTIONS=true` | comment updated on `b1-e2e-off-poc` |
| `.env.api.example:76` | `BIJAK_POC_QUESTIONS=false   # DEPRECATED NO-OP` | done on T36 |
| `apps/api/prisma/seed/exam.ts:178` | stale warning text | cosmetic, A2/A4 |

Order: `b1-e2e-off-poc` (REQ-A-001) before T36. The e2e specs that need a playable structured paper (`e2e/api/bijak-part-input.spec.ts`) stay open as REQ-B-003.

## 3. Units, routes, visible changes and checks

Columns: **Visible** = what an admin or pupil sees change; **Check** = a read-only SELECT or API probe. SELECTs not marked as run were written from the schema and not executed.

### 3.1 Merged in base (team A)

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

### 3.2 READY, not in base

| Unit | Branch @ head | Depends on | New routes / contract | Visible change | Check |
|---|---|---|---|---|---|
| T26 E2E seed | `r1/t26-e2e-seed` @ 0d59f1f8 | none | none (seed profile `e2e`) | Local only: T4 pupil, Admin Pusat, launch blueprint 3472/2 Disahkan through the real Sahkan checks. Refused in production | On UAT: `seeded_launch_blueprints` and `seeded_study_evidence` must be 0 (runbook 5.4, 8) |
| CI off PoC | `r1/b1-e2e-off-poc` @ b209b4ff (contains T26 at 510f085b; T26's head later became 0d59f1f8 = BASE-19 merged) | T26 | none | none for users | see 2.1 |
| T29 servability | `r1/t29-servability` @ c53e655d | T03, T04 | none (service + `servability/` contract; 25 reason codes, BM copy in one table) | none alone | spec `servability-parity` |
| T30 servability reads | `r1/t30-servability-reads` @ 09d53c56 | T29 | `GET /api/admin/servability/questions/:id`, `POST /questions/batch` (up to 100), `GET /overview`, `GET /lanes/databank`, `GET /lanes/bijak-spm`; Admin Pusat only, CSRF on the batch, rate limits in section 2 | Admin sees "Dilihat murid di" per question and activity with the reason; an archived question on a Terbit paper is shown as not served | overview takes about 2 s on a 5k bank in the unit's own measure; on the 400k bank H-A21 measured 22.5 s before the cache |
| H-A21 overview cache | `r1/ha21-overview-cache` @ 7399b63c | T30 | `computedAt` on the overview | Overview is cached 5 minutes, stale-while-revalidate, single flight, invalidated on question events and a papers fingerprint. No env var | warm p95 target under 500 ms (unit's claim, not re-measured here) |
| t45-lanes | `r1/t45-lanes` @ 3de39c85 | T30 | same lane routes, V2 hub order and wording | Kandungan SPM hub cards in V2 order; Bijak SPM card counts paper rows | none |
| T45 part 1 | `r1/t45-servability-acs` @ 8eba44c0 | T29 | none | Terbitkan on a question that no activity can serve is refused: "Soalan ini tidak boleh dipaparkan di mana-mana aktiviti murid, jadi belum boleh diterbitkan."; paper-level reason line | probe: approve an image question without its image |
| T33 DSKP gate | `r1/t33-leaf-tags` @ 95cea5be | T29, T32 | `GET /api/questions/:id/gate-check?gate=approve|submit`, `POST /api/questions/:id/status { to, reason? }`; `dskpStatus` and `dskpComplete` on reads; `cognitiveLevel` per leaf; 0102 | A new approval of an SPM Tingkatan 4 or 5 question needs unit, SP, TP, kertas and a cognitive level on every leaf ("Bahagian (b) belum ada aras pemikiran.", "Sila pilih kertas untuk soalan SPM."). Bulk approve and create-as-approved use the same gate; refused rows come back in `failed[]`. Already-approved untagged legacy questions stay served (D80 DEC-2) | runbook 3.5; `SELECT cognitive_level, count(*) FROM question_parts WHERE mode IS NOT NULL GROUP BY 1;` grows from 0 |
| T47 bank parity | `r1/t47-bank-parity` @ 20cc7ba3 (stacked on T33 276a6622) | T33 | `POST /api/questions/bulk-action/filter` (expectedCount, cap 500) | Studio list filters Tahun, Negeri, Kertas, Jenis; "Luluskan Hasil Tapisan" / "Arkib Semua"; illegal move reads "Peralihan '{from}' -> '{to}' tidak dibenarkan." (V2 wording). A 500-row filter bulk can stall; noted in the unit's ops text | dry run with a filter that matches under 500 rows |
| T34 builder review | `r1/t34-builder-review` @ 7bc3419e | T29 (and T33 per B2's order) | `PUT /api/admin/papers/:id/groups/:groupId` (title only), `GET/PUT /api/admin/section-pools/:questionId`, `POST/DELETE /api/admin/papers/:id/placements` (extra question; blocker "Lebih 1 soalan"), `PUT {reference}` with image check, publish body `{ override?, reason? }`, `blockerDetails` + `canOverride` | **Terbit gates:** R1E2E-06 Terbit refuses what the attempt path refuses (not overridable); R1E2E-07 / AC-R1-16.2 Terbit needs a Disahkan blueprint, overridable only with a reason of 5 or more characters and an audit row; D93: "Kumpulan perlu sekurang-kurangnya 2 soalan." blocks Terbit (not overridable); structured blockers with an overridable flag; a Terbit paper is read-only ("Kertas Terbit tidak boleh disunting. Tarik balik dahulu.") | `SELECT created_at, target_id FROM audit_events WHERE action = 'bijak.paper.published_override' ORDER BY created_at DESC LIMIT 20;` |
| T31 builder wire | `r1/t31-builder-wire` @ b3501db9 (contains T34) | T34; blocked on C1 type change (REQ-A-008) | `stimuli[]` (7 kinds, picture URL `/api/files/<token>`) on builder views | Admin builder shows every stimulus of a group | none |
| H-A15 + T44 | `r1/ha15-blueprint-evidence` @ 7e5d637e; `r1/t44-blueprint-fields` @ 2d9c100d (contains it) | none | Kontrak write schema gains "Boleh tanda auto" (`autoMarkable`); review flag "Blueprint perlu semakan" | **Sahkan:** study-origin evidence no longer counts, only `origin = 'admin'` rows (AC-39.2); a non-blank note is required ("Isi nota pengesahan dahulu.", 422 `fields.note`); skema Markah compares offered marks on choose-N sections (AC-39.7). Blueprints verified before this may fail a new Sahkan until evidence is added | `SELECT origin, count(*) FROM blueprint_evidence GROUP BY 1;` `SELECT code, version, auto_markable FROM blueprints WHERE status = 'active' ORDER BY code;` |
| T48 builder parity | `r1/t48-builder-parity` @ 1b76778f (contains T34) | T34 | 0104; `POST /api/admin/papers/:id/sections`, `POST /api/admin/papers/:id/sections/:sid/questions`, `DELETE /api/admin/papers/:id/questions/:questionId`; editable cover code, per-paper rule and select count, `pinned` per placement, stimulus edit (commit 089aa24b) | Semak Kertas: "Tambah bahagian", "Tambah soalan" (a new question inside the paper, through the approve gate), "Padam soalan", editable "Kod kertas (kulit)"; the Disematkan chip data. Terbit papers stay read-only | `SELECT admin_created, count(*) FROM paper_sections GROUP BY 1;` (section 1.1) |
| T48a paper list | `r1/t48a-paper-list` @ e5041595 | none | paper list filters Subjek and Cari; paper title at most 200 characters on create and update | Admin filters the Pembina Kertas list; a longer title is 422 "Tajuk kertas tidak boleh melebihi 200 aksara." | pre-check: `SELECT id, length(title) FROM papers WHERE length(title) > 200 LIMIT 20;` (expect 0 rows) |
| H-A13 archived paper | `r1/ha13-archived-paper` @ 4c5596d3 | T35 | contract text; `npm run contract:emit` needed | Archived question on a Terbit paper: a new sitting is refused ("Kertas ini sedang dikemas kini dan tidak boleh dicuba buat masa ini."), the card is hidden except for pupils with an open sitting, Cuba Lagi answers 409 `retryPaperGone`; the Arkib response warns the admin that Terbit papers hold the question | probe on a test paper |
| R1E2E-05 / 05b | `r1/e2e05b-own-stimuli` @ 57e7feee (contains 00cec26f) | T07 | optional `stimuli[]` on the attempt question | A paper with an image question can start (it gave Mula 403); a question's own stimuli of any kind show inline; a shared stimulus without a group stays refused (D90) | probe: start a paper holding an image MCQ |
| servability-own-stimuli | `r1/servability-own-stimuli` @ 11a4db3c | T29, 05b | none | The servability verdict equals what the bridge serves | spec |
| T42 part 1 | `r1/t42-reports-intake-acs` @ d1210e96 | T35 | `attemptId` and `paperId` on `POST /api/question-reports`; `paper { id, label, attemptId }` on admin report reads; 0103; 422 "Rujukan percubaan tidak sah.", "Soalan ini bukan sebahagian daripada percubaan itu.", "Kertas tidak sepadan dengan percubaan itu." | A pupil's report from a sitting names the paper; the admin queue shows it | section 1.1 |
| T42b | `r1/t42b-intake-acs` @ bca92f3d | none | none | An accepted intake figure becomes its own `question_image` file, so pupils can see it (AC-R1-14.3); file storage grows by one file per accepted figure | `SELECT count(*) FROM files WHERE purpose = 'question_image';` before and after (`files.purpose` confirmed in the schema) |
| T45b | `r1/t45b-question-detail-acs` @ 8342f9a0 | T42 part 1 | question detail lists the papers that place it (`section`, `versionNo`) | Admin sees where a question is used; uploading the missing image releases a held legacy question | none |
| T38 / T40 | `r1/t38-selfmark-reward` @ 662e602f; `r1/t40-attempts-acs` @ 90973d72 (contains T38) | T28 | none | D94: a self-mark that raises a part's mark credits 2 Syiling and 10 XP per mark gained, once per part and level, never above the part's marks, nothing back for a lower mark, none in Mod Pelajar | ledger rows with source `quiz_spm`; T40 adds specs only |
| T36 | `r1/t36-remove-poc` @ 5bc34543 | REQ-A-001 (`b1-e2e-off-poc`), T26 | none | PoC papers not playable; see 2.1 | `SELECT id, title, status FROM papers ORDER BY id LIMIT 10;` and try one PoC paper (403) |
| t04-minors | `r1/t04-minors` @ ec179b12 | T04 | none | Soalan by Chapter tile counts chaptered, ungrouped, approved questions only (R1E2E-09) | runbook 3.6 |

### 3.3 No deploy effect (test or docs only)

`r1/t39-k1-evidence` @ 1a26f7a6 and `r1/t37-r1-runbook` @ 971dfca0 (docs), `r1/ha9-pipeline-chain` @ 1024616c, `r1/ha12-conformance` @ e1fa7217, `r1/ha16-table-reader` @ b283a746 (shared table reader; no behaviour change), `r1/ha8-stale-specs` @ 56b1b6cc, `r1/t40-attempts-acs`, `r1/t41-curriculum-acs` @ 067ff3cc (specs). Reading only: T41 is not a deploy item.

## 4. Short text for the release notes

- **Admin, questions:** approval now needs the DSKP tags (T33); Studio gets filters and a filtered bulk action (T47); a stimulus group needs 2 members before Terbit (D93); a served group or stimulus cannot be edited (T32).
- **Admin, papers:** Terbit refuses what pupils cannot sit, and refuses a paper without a Disahkan blueprint unless an Admin Pusat overrides with a reason (audited) (T34); paper title at most 200 characters, paper list filters (T48a).
- **Admin, Kontrak:** "Boleh tanda auto" and "Blueprint perlu semakan" (T44); Sahkan needs a note and counts admin evidence only (H-A15).
- **Admin, Laporan Soalan:** "Arkib" archives the question (T35); reports from a sitting name the paper (T42).
- **Pupil:** approved questions appear in Databank, Latih Tubi SPM and Bab (T04); image and stimulus questions play (R1E2E-05/05b); Cuba Lagi earns rewards per attempt (T28) and a self-mark that raises a mark earns the difference (T38, D94); a paper whose question was archived cannot be started anew (H-A13).
- **Environment:** `THROTTLE_SERVABILITY_READ_PER_MINUTE` and `THROTTLE_SERVABILITY_OVERVIEW_PER_MINUTE` are optional; `E2E_SEED` must stay unset; `BIJAK_POC_QUESTIONS` is a no-op and should be removed (`render.yaml:27` and the demo redeploy script still say `true`).

## 5. Limits

- Branch heads were read from origin at the time of writing; many moved during the day. Re-check a head before quoting it.
- The 0103 SELECTs were run (section 1.1). The unit checks marked "probe" or written from the schema were not run. The runbook's SELECTs for 0092 to 0102 were run on a local database (its section 9).
- "Visible change" for unmerged units comes from the board rows, commit messages and the contract text on the branch; it was not exercised here.
- Whether the T47 500-row stall and the H-A21 22.5 s to 500 ms figures hold on the production-size bank was not measured here.
