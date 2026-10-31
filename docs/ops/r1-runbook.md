# R1 ops runbook (Bijak SPM release)

One page for the operator (DevOps / lead) who applies the R1 release to UAT or production, in order. It merges, and links to, the per-topic notes: [r1-release-notes.md](r1-release-notes.md), [r1-b01-question-lifecycle.md](r1-b01-question-lifecycle.md), [dskp-loader.md](dskp-loader.md), [e2e-seed.md](e2e-seed.md) (the local/E2E seed, T26) and [r1-k1-blueprint-evidence.md](r1-k1-blueprint-evidence.md) (the blueprint evidence list, T39). Where this page and a topic note differ, the topic note is the detail and this page is the order.

> **No AI session runs any of this on a server.** Agents write and test the code and these notes; a human with the deploy rights runs every command below, after the lead's explicit confirmation (see [api-runbook.md](api-runbook.md)). Every SQL block in this page is a read-only `SELECT` (plus one `VACUUM ANALYZE`, section 2.2) and is safe to run on a live database. The only things that change data are the migrations (applied by `prisma migrate deploy`), the DSKP loader script, and the admin's own actions in the app (Kontrak, Sahkan), all named below. This page contains environment variable **names** only, never values.

**What is in the base and what is not.** The page was written against `feature/v3-bijak-r1` at BASE-6 (`21ae62dd`) and refreshed (H-A25) against BASE-21 (`a6ff0c0d`): 0101 is in base since BASE-15; 0102 and 0103 are still on branches. Items marked "lands with" are not in base; they are on the named branch and must be merged, reviewed and released before the step applies. Verify the status in `docs/TRACKER.md` before you start.

| Item | In BASE-6? | Where it is |
|---|---|---|
| Migrations 0092, 0093, 0100 | yes | `apps/api/prisma/migrations/` |
| Rollback path and `VACUUM ANALYZE` for 0100 | no | `r1/t04-minors`, `docs/ops/r1-b01-question-lifecycle.md` (also summarised in section 2.2 here) |
| Migration 0101 `essay_choice` (T25) | yes, BASE-15 | `apps/api/prisma/migrations/0101_essay_choice` (T25 `r1/t25-essay-choice-store` @ e14f4f91) |
| Migration 0102 `leaf_cognitive_level` (T33) | no | `r1/t33-leaf-tags` @ 95cea5be (migration commit `76f53e6c`) |
| Migration 0103 `question_report_context` (T42 part 1, A2) | no | `r1/t42-reports-intake-acs` @ d1210e96 (commit `bc5c36e7`) |
| `THROTTLE_SERVABILITY_READ_PER_MINUTE` (T30) | no | `r1/t30-servability-reads` (commit `30a798d0`) |
| `E2E_SEED` and `docs/ops/e2e-seed.md` (T26) | no | `r1/t26-e2e-seed` (commit `dfa88cf0`) |
| `docs/ops/r1-k1-blueprint-evidence.md` (T39) | no | `r1/t39-k1-evidence` |
| Decision D95 (no seed on UAT) | no | PR amin-kerja-orang/prestasiplus#404, `docs/TRACKER.md` row D95 |

## 0. Before you start

1. Take a full dump and test the restore ([db-backup.md](db-backup.md)). Migration 0100 cannot be undone in place (section 2.2).
2. Maintenance window. 0100 (and 0101, 0102, 0103 when included) go out together with the new API/FE build (section 2); a few seconds of mixed state is possible.
3. Record the before-state with the SELECTs in section 3.1.
4. Environment (section 6) is set on the API service before it starts. `E2E_SEED` and `ALLOW_DEMO_SEED` are not set to true (section 6).
5. **No seed on UAT (D95).** Do not run `be:db:seed` with demo data on UAT. Blueprints are created and verified by an Admin Pusat in the app (section 5).

## 1. Order of work

| Step | What | Section |
|---|---|---|
| 1 | Backup, window, before-state SELECTs | 0, 3.1 |
| 2 | `prisma migrate deploy`: 0092, 0093, 0100, then 0101, 0102 and 0103 if their builds are in the release, in that order, together with the new API/FE build | 2.1 |
| 3 | `VACUUM ANALYZE question_versions` right after 0100 | 2.2 |
| 4 | After-state SELECTs for every migration applied | 3.2 to 3.6 |
| 5 | DSKP load: dry run, then real run, then verify | 4 |
| 6 | Blueprints: Admin Pusat creates each in Kontrak and presses Sahkan, in the order of section 5.2 | 5 |
| 7 | Smoke: login count, one Jana Kertas, one Latih Tubi SPM draw | 3.6, 5.5 |

## 2. Migrations and their order

`prisma migrate deploy` applies pending folders by number. UAT is at 0091, so a fresh deploy applies the folders below, in this order. Always check the list `prisma migrate status` shows against this table before you deploy.

### 2.1 The list

| Migration | In BASE-6? | What it does | Reversible? |
|---|---|---|---|
| `0092_bijak_standards` | yes | Blueprint standard model: profile, quota, KBAT, evidence, verification tables, `blueprints.serves_students`, per-part TP / KBAT / unit / form columns, `papers.standard_report`. **Downgrades every blueprint with `source = 'verified'` to `'spec'`.** Drops `blueprint_sections.topic_weights`; a guard aborts the migration if any row holds a value. | Manually; the reverse SQL is in the file header. The verified-to-spec downgrade is not undone. |
| `0093_part_options_image_file_index` | yes | One partial index `ix_part_options_image_file_id` for the pupil image read rule. Idempotent (`IF NOT EXISTS`). | `DROP INDEX "ix_part_options_image_file_id"` |
| `0100_question_lifecycle_approved` | yes | "Approved = servable". Old `approved` becomes `review`; old `published` becomes `approved`; the status CHECK allows `draft, review, approved, archived`; the partial indexes on `status = 'published'` are rebuilt on `'approved'`. One transaction. | **No.** Restore the dump (section 2.2). |
| `0101_essay_choice` (T25) | yes, BASE-15 | Adds `essay_choice` to the `question_parts.mode` CHECK, a nullable `question_parts.topics` jsonb and `ck_question_parts_topics` (2 to 6 topics, only on an `essay_choice` leaf). Additive; reads no status value. | Yes, after deleting `essay_choice` parts (reverse SQL in the file header). |
| `0102_leaf_cognitive_level` (T33) | **no, lands with T33** (`r1/t33-leaf-tags` @ 95cea5be) | Adds nullable `question_parts.cognitive_level` with `ck_question_parts_cognitive_level` (mengingat, memahami, mengaplikasi, menganalisis, menilai, mencipta) and `ck_question_parts_cognitive_level_leaf_only` (a part without a mode has none). Additive; no backfill (NULL = not set). | Yes (reverse SQL in the file header: drop the two CHECKs, then the column). |
| `0103_question_report_context` (T42 part 1) | **no, lands with T42** (`r1/t42-reports-intake-acs` @ d1210e96) | Adds nullable `question_reports.paper_id` (bigint) and `paper_label` (text, CHECK at most 200 characters), FK `fk_question_reports_paper_id` to `papers` (ON DELETE SET NULL), FK `fk_question_reports_attempt_id` to `exam_attempts` (**NOT VALID**: rows written before the migration are not checked, new and updated rows are) and index `ix_question_reports_paper_id`. Existing rows keep NULL. | Yes (reverse SQL in the file header: drop the index, the two FKs, the CHECK, then the two columns). |

Notes:

- 0101 and 0102 touch different columns of `question_parts` and do not depend on each other or on a status value; 0103 touches `question_reports` only. They still apply in number order. If only one of T25, T33 and T42 is in the release, apply only that one.
- **0103: do NOT run `VALIDATE CONSTRAINT fk_question_reports_attempt_id` in the release.** The constraint is created NOT VALID on purpose. `attempt_id` has existed since migration 0017 with no foreign key and nothing ever wrote it, so old rows may hold values that point nowhere; validating would scan and could fail the release. New and updated rows are checked without it. A later number must never be applied before an earlier pending one is accounted for.
- The planned table in `docs/architecture/v2-admin-student-pipeline.md` section 2 names 0101 and 0102 differently (`dskp_leaf_tags_and_facts`, `stimulus_kinds_wide`). The migration folders on the T25 and T33 branches are the authority; read the `migration.sql` header of any folder before you apply it.
- Deploy order for 0100: the migration and the API/FE build of the same release together. An old API against the new CHECK fails to write `published`; a new API against old data serves nothing.
- Code that still names `'published'` for a **question** status breaks (nothing served, or a CHECK failure). Paper `published` (Terbit) is unchanged. Details: [r1-b01-question-lifecycle.md](r1-b01-question-lifecycle.md).
- Consequence of 0092: after the upgrade **no blueprint serves students**. `POST /api/bijak/papers/generate` answers 422 `NO_BLUEPRINT` for a pupil until the blueprint is verified (section 5).

### 2.2 After 0100: statistics and the rollback path

**Statistics.** 0100 rewrites `question_versions` with two bulk UPDATEs and recreates five indexes, so the planner has stale statistics until the table is analysed. Run once, right after the migration finishes, outside any transaction (it takes no exclusive lock, so it is safe on a live database):

```sql
VACUUM ANALYZE question_versions;
```

(Source: `docs/ops/r1-b01-question-lifecycle.md` on `r1/t04-minors`, "Verification" step 7. On a compose deployment [r1-release-notes.md](r1-release-notes.md) section 2.4 has the `psql` wrapper. The run time on the production-size table has not been measured.)

**Rollback path (database).** 0100 cannot be reversed in place. Restore the pre-migration dump ([db-backup.md](db-backup.md)) and deploy the previous API/FE build together with the restore. Then tell Prisma that 0100 is not applied, so a later `migrate deploy` runs it again:

```bash
npx prisma migrate resolve --rolled-back 0100_question_lifecycle_approved
```

Do **not** run `migrate resolve` without the restore: the data would stay rewritten while Prisma believes the migration is pending. Rolling back the code after the first new approval is possible only together with a restore. For the other folders the same command form applies (`--rolled-back <folder>`), after their own reverse SQL (headers of the migration files) or the restore; the full sequence is in [r1-release-notes.md](r1-release-notes.md) section 6.

## 3. Verification SQL (read-only SELECTs)

Run with a read-only role or `psql -c` inside a read-only transaction (`BEGIN READ ONLY; ... ROLLBACK;`). Record every "before" result; the "after" blocks say what to expect.

### 3.1 Before the migrations (record these)

```sql
-- 0092: blueprints by source (UAT at handoff: 0 rows) and the guard value (expect 0, else 0092 aborts on purpose)
SELECT source, count(*) FROM blueprints GROUP BY source ORDER BY source;
SELECT count(*) AS sections_with_topic_weights FROM blueprint_sections WHERE topic_weights IS NOT NULL;
SELECT code, version, status, source FROM blueprints WHERE status = 'active' ORDER BY code;

-- 0100: version counts by status (expect only draft, review, approved, published, archived)
SELECT status, count(*) FROM question_versions GROUP BY status ORDER BY status;

-- becomes review (approved but never published)
SELECT count(*) AS approved_to_review FROM question_versions WHERE status = 'approved';

-- becomes approved (served today)
SELECT count(*) AS published_to_approved FROM question_versions WHERE status = 'published';

-- questions live today
SELECT count(*) AS live_questions FROM questions WHERE live_version_no IS NOT NULL;

-- a live pointer must be on a published version (expect 0 rows)
SELECT q.id FROM questions q
  JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
 WHERE v.status <> 'published' LIMIT 20;

-- 0100 (T04): published papers whose placements are pinned to an 'approved' version; those versions become 'review'.
-- Record the number; not 0 holds the window until the lead decides (r1-release-notes.md section 2.1).
SELECT count(*) AS placements_pinned_to_approved
  FROM paper_placements pp
  JOIN paper_sections ps ON ps.id = pp.paper_section_id
  JOIN papers p ON p.id = ps.paper_id AND p.status = 'published'
  JOIN question_versions v ON v.question_id = pp.question_id AND v.version_no = pp.pinned_version_no
 WHERE v.status = 'approved';

-- 0101 / 0102: question_parts shape before (neither column exists yet; the mode CHECK has no essay_choice)
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'question_parts' AND column_name IN ('topics', 'cognitive_level');          -- expect 0 rows
SELECT mode, count(*) FROM question_parts GROUP BY mode ORDER BY mode;                          -- record
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid = 'question_parts'::regclass AND conname = 'ck_question_parts_mode';           -- record

-- 0103: the report table before (nothing wrote attempt_id, so with_attempt is normally 0)
SELECT count(*) AS reports, count(attempt_id) AS with_attempt FROM question_reports;                  -- record
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'question_reports' AND column_name IN ('paper_id', 'paper_label');                -- expect 0 rows
```

### 3.2 After 0092 and 0093

```sql
-- the new blueprint columns and tables exist
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'blueprints' AND column_name IN ('serves_students', 'structure_hash', 'verification_id', 'kbat_marks', 'level_share');  -- 5 rows
SELECT table_name FROM information_schema.tables WHERE table_name IN ('blueprint_evidence', 'blueprint_verifications');                      -- 2 rows
SELECT column_name FROM information_schema.columns WHERE table_name = 'blueprint_sections' AND column_name = 'topic_weights';                -- 0 rows

-- no blueprint serves students and none is verified (0092 downgraded every 'verified' row); expect source <> 'verified' everywhere
SELECT code, version, status, source, serves_students FROM blueprints WHERE status = 'active' ORDER BY code;

-- 0093: the index exists
SELECT indexname FROM pg_indexes WHERE indexname = 'ix_part_options_image_file_id';             -- 1 row
```

### 3.3 After 0100 and the new API (counts by status)

Run `VACUUM ANALYZE question_versions;` first (section 2.2).

```sql
-- no 'published' remains; approved = old published; review = old review + old approved
SELECT status, count(*) FROM question_versions GROUP BY status ORDER BY status;

-- every live pointer is on an approved version (expect 0 rows)
SELECT q.id FROM questions q
  JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
 WHERE v.status <> 'approved' LIMIT 20;

-- at most one approved version per question (expect 0 rows)
SELECT question_id FROM question_versions WHERE status = 'approved' GROUP BY 1 HAVING count(*) > 1;

-- every predicate reads status = 'approved'; none mentions 'published'
SELECT indexname, indexdef FROM pg_indexes
 WHERE tablename = 'question_versions' AND indexdef LIKE '%WHERE%' ORDER BY indexname;

-- the status CHECK lists the four statuses
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'ck_question_versions_status';
```

Check by hand: `approved_after = published_before` and `review_after = review_before + approved_before` (from 3.1). The migration also prints `0100 pre-flight` and `0100 post` NOTICE lines with these counts in the migrate log.

### 3.4 After 0101 (T25 essay_choice; only when applied)

```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'question_parts' AND column_name = 'topics';   -- 1 row, jsonb
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'question_parts'::regclass AND conname = 'ck_question_parts_mode';    -- now lists essay_choice
SELECT conname FROM pg_constraint WHERE conrelid = 'question_parts'::regclass AND conname = 'ck_question_parts_topics';                   -- 1 row

-- the migration is additive: the mode counts equal the 3.1 record, and nothing has topics yet
SELECT mode, count(*) FROM question_parts GROUP BY mode ORDER BY mode;
SELECT count(*) AS with_topics FROM question_parts WHERE topics IS NOT NULL;                                                              -- 0 right after the migration

-- invariant afterwards: topics only on an essay_choice leaf, 2 to 6 of them (expect 0 rows)
SELECT id FROM question_parts
 WHERE (mode IS DISTINCT FROM 'essay_choice' AND topics IS NOT NULL)
    OR (mode = 'essay_choice' AND (topics IS NULL OR jsonb_array_length(topics) NOT BETWEEN 2 AND 6)) LIMIT 20;
```

### 3.5 After 0102 (T33 leaf cognitive level; only when applied)

```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'question_parts' AND column_name = 'cognitive_level';  -- 1 row, text
SELECT conname FROM pg_constraint WHERE conrelid = 'question_parts'::regclass
   AND conname IN ('ck_question_parts_cognitive_level', 'ck_question_parts_cognitive_level_leaf_only');                                  -- 2 rows

-- no backfill: right after the migration every part is NULL
SELECT cognitive_level, count(*) FROM question_parts GROUP BY cognitive_level ORDER BY 1;                                                -- one row, NULL, = total parts

-- invariant afterwards (expect 0 rows): a part without a mode has no level
SELECT id FROM question_parts WHERE mode IS NULL AND cognitive_level IS NOT NULL LIMIT 20;
```

### 3.5b After 0103 (T42 report context; only when applied)

```sql
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name = 'question_reports' AND column_name IN ('paper_id', 'paper_label');                 -- 2 rows

-- 3 constraints; the attempt FK must stay NOT VALID (convalidated = false). Do not validate it in the release.
SELECT conname, convalidated FROM pg_constraint
 WHERE conrelid = 'question_reports'::regclass
   AND conname IN ('ck_question_reports_paper_label', 'fk_question_reports_paper_id', 'fk_question_reports_attempt_id');

SELECT indexname FROM pg_indexes WHERE indexname = 'ix_question_reports_paper_id';                       -- 1 row

-- nothing changed in the data: same total as 3.1, no paper yet
SELECT count(*) AS reports, count(paper_id) AS with_paper FROM question_reports;                         -- with_paper 0

-- later, once pupils report from a sitting: every report that names an attempt also names its paper (expect 0 rows)
SELECT id FROM question_reports WHERE attempt_id IS NOT NULL AND paper_id IS NULL LIMIT 20;
```

The migration history, after all of them:

```sql
SELECT migration_name, finished_at FROM _prisma_migrations
 WHERE migration_name IN ('0092_bijak_standards', '0093_part_options_image_file_index', '0100_question_lifecycle_approved',
                          '0101_essay_choice', '0102_leaf_cognitive_level', '0103_question_report_context')
 ORDER BY started_at;
```

### 3.6 The servable count and the login count

The login page count ("N+ Soalan") and the per-subject practice cards use one definition (live version, approved, active, MCQ, not PKSK, a learner-visible Tingkatan 4 or 5 level, an active subject linked to that level). It must equal the sum of the subject cards and must not change by accident across 0100:

```sql
-- the login count (QUESTION_COUNT_SQL + SPM_SERVABLE_SQL)
SELECT count(*) AS login_count
  FROM questions q
  JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
 WHERE q.is_active AND v.status = 'approved' AND v.type = 'mcq'
   AND (v.education_level_id IS NULL OR NOT EXISTS (SELECT 1 FROM education_levels el WHERE el.id = v.education_level_id AND (el.stage = 'primary' OR NOT el.is_active)))
   AND NOT EXISTS (SELECT 1 FROM question_tags pt WHERE pt.question_id = q.id AND pt.kind = 'pksk_domain')
   AND EXISTS (SELECT 1 FROM education_levels ol WHERE ol.id = v.education_level_id AND ol.code IN ('T4', 'T5'))
   AND EXISTS (SELECT 1 FROM subjects sj WHERE sj.id = v.subject_id AND sj.is_active)
   AND EXISTS (SELECT 1 FROM subject_levels sl WHERE sl.subject_id = v.subject_id AND sl.education_level_id = v.education_level_id);

-- served today, any type and level (the wider "approved = servable" count: should equal the old live count)
SELECT count(*) AS servable FROM questions q
  JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no AND v.status = 'approved'
 WHERE q.is_active;

-- the login count by subject (compare with the practice cards)
SELECT sj.code, count(*) AS n
  FROM questions q
  JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
  JOIN subjects sj ON sj.id = v.subject_id
 WHERE q.is_active AND v.status = 'approved' AND v.type = 'mcq'
 GROUP BY sj.code ORDER BY sj.code;
```

Note (D91): the practice **card** counts ungrouped questions only; the login count still counts group members, so on the demo seed the card is lower than the login count by the group MCQs. That difference is intended.

## 4. DSKP load

UAT has 0 curriculum nodes until this runs, so DSKP tagging, blueprints and Jana Kertas cannot work there. The loader is a script, not a migration: insert-only, idempotent, one transaction per subject, Tingkatan 1-5 only. Full detail, flags and rollback: [dskp-loader.md](dskp-loader.md).

Run from the migrate image or any container with the API source and `DATABASE_URL`, after a backup:

```
npm run dskp:load -w @pp/api -- --dry-run          # always first; writes nothing
npm run dskp:load -w @pp/api -- --create-missing-subjects     # the real run
npm run dskp:load -w @pp/api -- --dry-run          # again: every insert column must now be 0
```

Expected on an empty tree: 2,844 nodes and 1,394 TP descriptors over 13 subjects, 4 rejected TP rows (Landskap dan Nurseri), the dry run and the real run printing the same numbers. Exit code 0 is done; 1 means a subject failed (its transaction was rolled back; fix and re-run).

Verify with read-only SELECTs:

```sql
SELECT s.code AS subject, l.code AS level, count(*) AS nodes
  FROM curriculum_nodes n
  JOIN subjects s ON s.id = n.subject_id
  JOIN education_levels l ON l.id = n.education_level_id
 GROUP BY s.code, l.code ORDER BY s.code, l.code;

SELECT DISTINCT l.code FROM curriculum_nodes n JOIN education_levels l ON l.id = n.education_level_id;  -- T4, T5 only
SELECT count(*) FROM curriculum_nodes c WHERE parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM curriculum_nodes p WHERE p.id = c.parent_id);  -- 0
SELECT count(*) FROM curriculum_tp_descriptors WHERE tp NOT BETWEEN 1 AND 6;  -- 0
```

Rollback is by deleting what the load added, only before any question is tagged (nodes are referenced `ON DELETE RESTRICT`); after tagging, restore the backup. Steps are in [dskp-loader.md](dskp-loader.md).

## 5. Blueprints on UAT: created and verified by an Admin Pusat (D95), no seed

**Decision D95** (product owner via the user, 2026-10-31; PR amin-kerja-orang/prestasiplus#404, `docs/TRACKER.md` row D95; it supersedes the earlier "seed on UAT" answer and the "Option B" of [r1-release-notes.md](r1-release-notes.md) section 4.1): on UAT an Admin Pusat creates each blueprint by hand in Kontrak, through the real flow, and presses **Sahkan**. Demo seeds, the launch-blueprint seed (`examLaunchBlueprintsSeed`) and the E2E seed are **local / E2E only**. No AI session acts on any server.

After 0092 every blueprint is Spec and serves no pupil, so a pupil's Jana Kertas answers 422 `NO_BLUEPRINT` for a subject until its blueprint is verified. Announce Jana Kertas to pupils only for the subject and kertas pairs verified here.

### 5.1 The rule for Sahkan

- **Only Admin Pusat** can verify (403 for any other role). Sahkan runs the blueprint gate (AC-39.1) and the evidence comparison (AC-39.7) and lists **every** failure at once; the verification row is insert-only and records the verifier.
- **Two-body evidence rule:** D76(4) in `docs/TRACKER.md`, AC-39.2 and AC-39.7 in `docs/requirements/v2-bijak-spm.md`. The record cites trial papers **and their skema** from at least two bodies, or an LPM format / JSU document. In the code (`packages/exam-core/src/evidence.ts:checkEvidence`): at least two distinct bodies that each have a `trial_paper` item and a `skema` item, unless an `lpm_format` item exists; and every compared value (duration, total marks, and per section mark budget, rule, question count) must be supported by two bodies and contradicted by none. (TRACKER row D95 calls this rule "D77"; the rule itself is D76(4), AC-39.2 and AC-39.7. D77 is an unrelated decision.) Topic quota and KBAT are not compared; they must be filled, and any value marked "Belum disemak" must be reviewed.
- Every check Sahkan runs, with the code path and what is missing for each blueprint: [r1-k1-blueprint-evidence.md](r1-k1-blueprint-evidence.md) (T39; lives on branch `r1/t39-k1-evidence` until merged).
- Do not edit a Disahkan blueprint: a structural edit makes a new Spec version; the older Disahkan version keeps serving pupils until the new one is verified.
- Admin Pusat in Mod Pelajar may generate from a Spec head (test data); Admin Sekolah and pupils need Disahkan.

### 5.2 Order

| # | Blueprint | State of evidence (see the evidence list for detail) |
|---|---|---|
| 1 | **3472/2** Matematik Tambahan K2, the worked example (step by step in the evidence list, section 2) | Repo data is sufficient except the duration line, which may have only one real supporting body (unconfirmed). |
| 2 | **1449/1** Matematik K1 | Not ready: KBAT marks undetermined and only one body has paper + skema. |
| 3 | **1249/1** Sejarah K1 | Not ready: one body only; no profile, quota or KBAT in the repo. |
| 4 | **4531/1** Fizik K1 | Not ready: one body has a paper; no profile or KBAT in the repo. |
| 5 | **Sains K1** (paper code to be read from a cover; unconfirmed) | Not ready: no paper evidence in the repo. |

Do 2 to 5 only when the evidence list shows the evidence from two or more bodies is in hand for that paper. A blueprint with a single evidence body, or with an empty KBAT field, cannot pass; do not work around the check.

### 5.3 Steps (Admin Pusat, in Pentadbiran)

1. Prerequisite: the DSKP load (section 4) has run, so "Tambah unit" lists the subject's units. Without units the quota cannot be filled.
2. Kontrak (`/admin/spm/kontrak`) > `Tambah Kontrak` > subject and kertas > fill the paper, the sections, the difficulty profile, the topic quota and the KBAT marks until the panel shows no problem > `Simpan`. If the contract already exists (for example a PoC contract on a database that ran the old seeds), open it and edit; each save is a new version.
3. Tab **Pengesahan** > `Tambah Bukti` for each trial paper and skema > `Semak Bukti` until every line reads "Sepadan".
4. Fill `Nota pengesahan` (required by the screen), press `Sahkan`, confirm. Success message: "Kontrak berjaya disahkan."

### 5.4 Read-only SELECTs: blueprint state before and after Sahkan

Tables and columns are those of `apps/api/prisma/schema/exam.prisma` (`blueprints`, `blueprint_sections`, `blueprint_evidence`, `blueprint_verifications`). Replace the code list as needed.

**Before Sahkan** (per blueprint; the gate fails until each of these is satisfied):

```sql
-- the head: status, source, serving flag, duration and totals
SELECT b.code, b.version, s.code AS subject, b.kertas, b.status, b.source, b.serves_students,
       b.duration_min, b.total_marks, b.kbat_marks, b.verification_id
  FROM blueprints b JOIN subjects s ON s.id = b.subject_id
 WHERE b.status = 'active' AND b.code IN ('3472/2', '1449/1', '1249/1', '4531/1') ORDER BY b.code;

-- sections: structure, profile, quota size, KBAT and whether the KBAT value is still "Belum disemak"
SELECT b.code, bs.position, bs.label, bs.rule_type, bs.rule_n, bs.question_count, bs.mark_budget, bs.allowed_modes,
       (bs.profile IS NOT NULL) AS has_profile,
       jsonb_array_length(COALESCE(bs.quota -> 'lines', '[]'::jsonb)) AS quota_lines,
       bs.kbat_marks, bs.kbat_reviewed
  FROM blueprints b JOIN blueprint_sections bs ON bs.blueprint_id = b.id
 WHERE b.status = 'active' AND b.code IN ('3472/2', '1449/1', '1249/1', '4531/1') ORDER BY b.code, bs.position;

-- quota lines still "Belum disemak" (a line the admin saved has no 'reviewed' key; a seeded unreviewed one has false)
SELECT b.code, bs.position, count(*) AS unreviewed_lines
  FROM blueprints b JOIN blueprint_sections bs ON bs.blueprint_id = b.id
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(bs.quota -> 'lines', '[]'::jsonb)) l
 WHERE b.status = 'active' AND (l ->> 'reviewed') = 'false' GROUP BY b.code, bs.position ORDER BY b.code, bs.position;

-- evidence rows on the head
SELECT b.code, e.kind, e.body, e.year, e.paper_code, e.origin
  FROM blueprints b JOIN blueprint_evidence e ON e.blueprint_id = b.id
 WHERE b.status = 'active' ORDER BY b.code, e.body, e.kind;

-- the body rule: bodies that have BOTH a trial paper and a skema (needs >= 2), and any LPM format item
SELECT b.code,
       (SELECT count(*) FROM (SELECT e.body FROM blueprint_evidence e WHERE e.blueprint_id = b.id
                               GROUP BY e.body HAVING bool_or(e.kind = 'trial_paper') AND bool_or(e.kind = 'skema')) x) AS bodies_with_paper_and_skema,
       (SELECT count(*) FROM blueprint_evidence e WHERE e.blueprint_id = b.id AND e.kind = 'lpm_format') AS lpm_items
  FROM blueprints b WHERE b.status = 'active' ORDER BY b.code;
```

These SELECTs show the inputs of the gate. They do not replace the `Semak Bukti` panel, which is the live check (`GET /api/admin/blueprints/:subject/:kertas/verification`).

**After Sahkan:**

```sql
-- verified, serving, with the verifier and the frozen check
SELECT b.code, b.version, b.source, b.serves_students, v.id AS verification_id, v.verified_at, v.verified_by_id,
       v.verifier_role, (v.structure_hash = b.structure_hash) AS hash_matches,
       jsonb_array_length(v.evidence_snapshot) AS evidence_rows, (v.check_result ->> 'passes') AS check_passed
  FROM blueprints b JOIN blueprint_verifications v ON v.id = b.verification_id
 WHERE b.status = 'active' ORDER BY b.code;
-- expect for each verified pair: source = verified, serves_students = true, hash_matches = true, check_passed = true

-- at most one serving version per subject and kertas (expect 0 rows)
SELECT subject_id, kertas, count(*) FROM blueprints WHERE serves_students GROUP BY 1, 2 HAVING count(*) > 1;

-- the pairs that now serve pupils (announce Jana Kertas for these only)
SELECT s.code AS subject, b.kertas, b.code, b.version
  FROM blueprints b JOIN subjects s ON s.id = b.subject_id WHERE b.serves_students ORDER BY s.code, b.kertas;
```

**No seed ran on UAT (D95):** both of these must return 0 on UAT. The launch-blueprint seed marks its rows `provenance = 'paper'` and its evidence `origin = 'study'`; admin-created rows have neither.

```sql
SELECT count(*) AS seeded_launch_blueprints FROM blueprints WHERE provenance = 'paper';
SELECT count(*) AS seeded_study_evidence FROM blueprint_evidence WHERE origin = 'study';
```

### 5.5 Smoke

A pupil of the verified subject calls Jana Kertas (`POST /api/bijak/papers/generate`): 201, or 422 `SHORTAGE` if the question pool of that subject is short (that is a pool answer, not a blueprint one). 422 `NO_BLUEPRINT` means the blueprint is not serving yet.

## 6. Environment

Set on the API service before it starts (examples in `.env.api.example`; no secret goes in the repo, and this page gives names only).

| Variable | Value for R1 | Meaning |
|---|---|---|
| `BIJAK_POC_QUESTIONS` | `false` on UAT and production | `true` serves the reserved PoC id block (seeded PoC papers, Jana pool), for staging / dev / e2e only. `false` (the default) serves question-bank questions only. |
| `OCR_ENGINE` | `none` (default) or `tesseract` | `none`: scanned pages end as `OCR_UNAVAILABLE`. `tesseract`: tesseract.js with local language data, never downloads; then `OCR_LANG_DIR` must be an absolute folder holding `msa.traineddata` and `eng.traineddata`. |
| `OCR_LANG_DIR` | empty, or the folder above | Required only with `OCR_ENGINE=tesseract`. |
| `THROTTLE_SERVABILITY_READ_PER_MINUTE` | optional; default 120 when unset | **Lands with T30** (`r1/t30-servability-reads`). Per-user rate limit of the admin servability reads ("Dilihat murid di", the hub, the lanes); a request above the limit answers 429. Integer, minimum 1. Cited from `apps/api/src/common/config/env.schema.ts`, `apps/api/src/modules/questions/http/servability.controller.ts` and `.env.api.example` on that branch. A normal admin session needs no change. |
| `ALLOW_DEMO_SEED` | unset / `false` | Never `true` on UAT or production. Demo seeds (the demo data, the PoC blueprints, the launch blueprints and the E2E seed are all demo modules) are skipped in production; `.env.api.example` states that only the dev/e2e compose file sets `true`. |
| `E2E_SEED` | **must be unset (OFF) on every server, production above all** | **Lands with T26** (`r1/t26-e2e-seed`). Read only by the seed script `apps/api/prisma/seed/e2e.ts` (`E2E_FLAG`): the E2E seed runs only with `--profile=e2e` and `E2E_SEED=1` (or `true`). It creates a pupil, an Admin Pusat and verifies a blueprint by seed. Local / E2E only (section 7). |

## 7. Local / E2E seed (never on a server)

For local stacks and the E2E suite only (lands with T26), behind two keys (`--profile=e2e` and `E2E_SEED=1`), default off. It creates a Tingkatan 4 pupil, an Admin Pusat and moves one launch blueprint to Disahkan through the same checks as Sahkan. It is not a UAT step: on UAT the same result is reached by hand (section 5). Command, accounts and the blueprint it picks: [e2e-seed.md](e2e-seed.md) (file lands with T26).

```
E2E_SEED=1 npm run be:db:seed -- --profile=e2e
```

## 8. If something goes wrong

| Symptom | Likely cause | Action |
|---|---|---|
| After deploy nothing is served in practice, login count 0 | API/FE build older than 0100 (still reads `published`) | Deploy the matching build; run 3.3 and 3.6. |
| A write fails with a CHECK violation on `ck_question_versions_status` | An old API instance still running | Stop old instances. |
| Pupil Jana Kertas answers 422 `NO_BLUEPRINT` | The blueprint is still Spec after 0092 (or not created) | Section 5. |
| Sahkan answers 422 `VERIFICATION_FAILED` | A gate or evidence line fails | Read the listed failures; fix the contract or add the missing evidence (evidence list). Do not seed around it. |
| `seeded_launch_blueprints` or `seeded_study_evidence` is not 0 on UAT | A demo seed ran | Stop; report to the lead (D95 says no seed on UAT). |
| DSKP load exit code 1 | One subject failed; its transaction rolled back | Read the report, fix, re-run (finished subjects report `same`). |
| 0092 aborts on `topic_weights` | A row holds a value | Take the value out first (the guard prevents silent loss); see the migration header. |
| Need to go back past 0100 | 0100 is not reversible | Section 2.2: restore the dump with the previous API/FE build, then `prisma migrate resolve --rolled-back 0100_question_lifecycle_approved`. |
| 429 on the servability reads of the admin | `THROTTLE_SERVABILITY_READ_PER_MINUTE` too low for the load | Raise it (lands with T30); default is 120 per user per minute. |

## 9. Verification status of this page

**Latest run (H-A25, 2026-10-31): ran on local migrated DB (BASE-21 `a6ff0c0d` + 0102 @ `95cea5be` (T33) + 0103 @ `d1210e96` (T42), demo seed), 58/58 ok.** Every statement in the SQL blocks of this page (57 SELECTs and the one `VACUUM ANALYZE`) was run one by one with `psql` against a throwaway local Postgres 16 container (no server, no shared database; the container was removed afterwards). No statement errored and none was changed by the run. 0105 (A2, H-A18) was not on origin yet and is not part of this run.

- **Staged database (before-state):** migrated to 0091, the three 0092 pre-flight SELECTs of 3.1 (3/3); then to 0093, the remaining 11 "before" SELECTs of 3.1, including the two new 0103 ones (11/11). They return zero rows or zero counts (empty tables): this proves syntax and column names, not counts.
- **Full database:** the 46 migrations of the base plus 0102 and 0103 from the two branches (copied into a scratch migrations folder, not committed), then the demo seed with `ALLOW_DEMO_SEED=1` (profile `poc`, 27 modules, exit 0). The other 44 statements (2.2, 3.2 to 3.6, 3.5b, 4, 5.4) ran there, 44/44.
- **Notable results:** `approved` 1268, `archived` 1, `draft` 1 and no `published`; servable 1268, login count 493; `question_parts.topics` (jsonb) and `.cognitive_level` (text) exist with their CHECKs and every `cognitive_level` is NULL (1277 parts); 0103 added `question_reports.paper_id` (bigint) and `paper_label` (text); `fk_question_reports_attempt_id` has `convalidated = f` as designed, the paper FK and the label CHECK are validated; `ix_question_reports_paper_id` exists; `question_reports` is empty so `with_paper` is 0.
- **Reverse SQL of 0102 and 0103** (the file headers) was also run once inside a transaction that was rolled back: all five objects dropped cleanly and came back after the rollback. This proves the SQL, not a rollback procedure.
- Not run: `prisma migrate resolve`, `npm run dskp:load`, the API, and the 5.4 after-Sahkan state (no blueprint is verified on the seeded database; see the earlier run below).

**Earlier run (T37, BASE-6 + 0101 + 0102, 51/51 ok)** and its method are kept below for the record.

**SQL: ran on a local migrated database, 51/51 statements ok.** Every statement in the SQL blocks of this page (50 SELECTs and the one `VACUUM ANALYZE`) was executed one by one with `psql` against a throwaway local Postgres 16 container (no server, no shared database). Statements that errored: none; no statement was changed by the run.

- **Database A (staged), empty tables:** migrated with `prisma migrate deploy` to 0091 and the 0092 pre-flight SELECTs of 3.1 were run (3 statements); then migrated to 0093 and the remaining "before" SELECTs of 3.1 were run (9 statements). They returned zero rows or zero counts because the tables were empty; this proves the syntax and the column names, not the counts. The "before" SELECTs cannot run on a fully migrated database (for example `blueprint_sections.topic_weights` is gone after 0092).
- **Database B (full):** BASE-6 migrations (0092, 0093, 0100) plus `0101_essay_choice` (from commit `d398a576`, branch `r1/t25-essay-choice-store`) and `0102_leaf_cognitive_level` (from commit `76f53e6c`, branch `r1/t33-leaf-tags`), copied into a scratch migrations folder and not committed; then the demo seed (`tsx prisma/seed/index.ts`, profile `poc`, 27 modules, exit 0). The remaining 39 statements (2.2, 3.2 to 3.6, 4, 5.4) ran here, all ok.
- **Notable results on the seeded database:** `servable` equals the count of `approved` versions (1268) and the login count is 493 (the figure the D91 note in 3.6 and the T05 servable-counts spec pin for the demo seed); no `published` status remains; the status CHECK lists `draft, review, approved, archived`; `question_parts.topics` and `.cognitive_level` exist with their CHECKs; every `cognitive_level` is NULL right after the migration; the 4 DSKP checks of section 4 returned T4/T5 only, 0 orphans, 0 bad TP. The two "no seed ran" checks of 5.4 return **6** and **16** on this database, which proves they detect the launch-blueprint seed (on UAT, per D95, both must be 0).
- **After-Sahkan SELECTs:** on the seeded database no blueprint is verified, so they return no rows. They were also run once inside a transaction that was rolled back, after inserting one verification row for `3472/2` and flipping it to verified and serving: they returned the expected row (`hash_matches` true, `check_passed` true, 0 duplicate serving pairs, the pair listed). This only exercises the SQL; it is not a real Sahkan.
- Not run: the shell commands (`npm run dskp:load`, `prisma migrate resolve`, `be:db:seed`), the DSKP loader report numbers (2,844 nodes) and the API endpoints. The DSKP counts of this run came from the seed's curriculum module, not from the loader script.

**Still not verified**

- 0102 and 0103 are read from the T33 and T42 branches, not from base; their final content may change in review. `\d question_parts` and `\d question_reports` after a deploy are the check. 0105 (A2, H-A18) is not covered; add it when it lands.
- `VACUUM ANALYZE question_versions`: run time on the production-size table was not measured.
- `THROTTLE_SERVABILITY_READ_PER_MINUTE` and `E2E_SEED` are read from branches `r1/t30-servability-reads` and `r1/t26-e2e-seed`, not from BASE-6.
- Whether UAT already holds PoC blueprints, DSKP nodes or demo data is unknown; sections 3.1 and 5.4 record it.
- The PR #404 text for D95 was read from the PR head (`origin/pr404`), not from `feature/v3-bijak-r1`.
