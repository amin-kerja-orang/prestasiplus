# R1 ops runbook (Bijak SPM release)

One page for the operator (DevOps / lead) who applies the R1 release to UAT or production, in order. It merges, and links to, the per-topic notes: [r1-release-notes.md](r1-release-notes.md), [r1-b01-question-lifecycle.md](r1-b01-question-lifecycle.md), [dskp-loader.md](dskp-loader.md) and [e2e-seed.md](e2e-seed.md) (the local/E2E seed, T26). Where this page and a topic note differ, the topic note is the detail and this page is the order.

> **No AI session runs any of this on a server.** Agents write and test the code and these notes; a human with the deploy rights runs every command below, after the lead's explicit confirmation (see [api-runbook.md](api-runbook.md)). Every SQL block in this page is a read-only `SELECT` and is safe to run on a live database. The only things that change data are the migrations (applied by `prisma migrate deploy`) and the DSKP loader script, both named below.

## 0. Before you start

1. Take a full dump and test the restore ([db-backup.md](db-backup.md)). Migration 0100 cannot be undone in place (section 2).
2. Maintenance window. 0100 and the new API/FE build go out together (section 2); a few seconds of mixed state is possible.
3. Record the before-state with the SELECTs in section 3.1.
4. Environment (section 6) is set on the API service before it starts.

## 1. Order of work

| Step | What | Section |
|---|---|---|
| 1 | Backup, window, before-state SELECTs | 0, 3.1 |
| 2 | `prisma migrate deploy`: 0092, 0093, 0100, 0101 in that order, together with the new API/FE build | 2 |
| 3 | After-state SELECTs | 3.2 to 3.4 |
| 4 | DSKP load: dry run, then real run, then verify | 4 |
| 5 | Re-verify the Disahkan blueprints (Admin Pusat, in the UI) | 5 |
| 6 | Smoke: login count, one Jana Kertas, one Latih Tubi SPM draw | 3.4, 5 |

## 2. Migrations and their order

`prisma migrate deploy` applies pending folders by number. UAT is at 0091, so a fresh deploy applies exactly these four, in this order:

| Migration | What it does | Reversible? |
|---|---|---|
| `0092_bijak_standards` | Blueprint standard model: profile, quota, KBAT, evidence, verification tables, `blueprints.serves_students`, per-part TP / KBAT / unit / form columns, `papers.standard_report`. **Downgrades every blueprint with `source = 'verified'` to `'spec'`** (the old Disahkan had no verifier or evidence). Drops `blueprint_sections.topic_weights`; a guard aborts the migration if any row holds a value. | Manually; the reverse SQL is in the file header. The verified-to-spec downgrade is not undone. |
| `0093_part_options_image_file_index` | One partial index `ix_part_options_image_file_id` for the pupil image read rule. Idempotent (`IF NOT EXISTS`): a local database that recorded the old `0092` folder name keeps the same index. | `DROP INDEX "ix_part_options_image_file_id"` |
| `0100_question_lifecycle_approved` | "Approved = servable". Old `approved` becomes `review`; old `published` becomes `approved`; the status CHECK now allows `draft, review, approved, archived`; the partial indexes on `status = 'published'` are rebuilt on `'approved'`. One transaction. | **No.** Restore the dump to go back. |
| `0101_essay_choice` | Adds `essay_choice` to the `question_parts.mode` CHECK and a nullable `question_parts.topics` jsonb (2 to 6 topics). Additive; reads no status value. | Yes, after deleting `essay_choice` parts (reverse SQL in the header). |

Notes:

- Deploy order for 0100: the migration and the API/FE build of the same release together. An old API against the new CHECK fails to write `published`; a new API against old data serves nothing.
- Code that still names `'published'` for a **question** status breaks (nothing served, or a CHECK failure). Paper `published` (Terbit) is unchanged. Details: [r1-b01-question-lifecycle.md](r1-b01-question-lifecycle.md).
- Numbers above 0101 are team A's planned range; they are not part of this runbook. Check the numbering note in `docs/architecture/v2-admin-student-pipeline.md` section 2 before applying a later migration.
- Consequence of 0092: after the upgrade **no blueprint serves students**. `POST /api/bijak/papers/generate` answers 422 `NO_BLUEPRINT` for a pupil until step 5 is done. Curated Kertas Pilihan papers are not affected.

## 3. Verification SQL (read-only SELECTs)

Run with a read-only role or `psql -c` inside a read-only transaction (`BEGIN READ ONLY; ... ROLLBACK;`).

### 3.1 Before 0100 (record these)

```sql
-- version counts by status (expect only draft, review, approved, published, archived)
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
```

Also record the blueprint state before 0092 (so you know what needs re-verifying):

```sql
SELECT code, version, status, source FROM blueprints WHERE status = 'active' ORDER BY code;
```

### 3.2 After 0100 and the new API (counts by status)

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
```

Check by hand: `approved_after = published_before` and `review_after = review_before + approved_before` (from 3.1). The migration also prints `0100 pre-flight` and `0100 post` NOTICE lines with these counts in the migrate log.

### 3.3 After 0092 / 0101

```sql
-- no blueprint serves students until it is re-verified (expect serves_students = false everywhere right after 0092)
SELECT code, version, status, source, serves_students FROM blueprints WHERE status = 'active' ORDER BY code;

-- the essay_choice migration landed
SELECT column_name FROM information_schema.columns WHERE table_name = 'question_parts' AND column_name = 'topics';

-- the migration history (the four R1 folders applied, in order)
SELECT migration_name, finished_at FROM _prisma_migrations
 WHERE migration_name IN ('0092_bijak_standards', '0093_part_options_image_file_index', '0100_question_lifecycle_approved', '0101_essay_choice')
 ORDER BY started_at;
```

### 3.4 The servable count and the login count

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

## 5. Disahkan blueprint re-verification

After 0092 every blueprint is Spec and serves no pupil (section 2). An Admin Pusat verifies the ones pupils need, in Pentadbiran: Kontrak (Simulasi) > the blueprint > tab Pengesahan > `Sahkan`. Rules (D76, D77):

- Only Admin Pusat can verify. Sahkan runs the blueprint gate and the evidence comparison and lists **every** failure at once; the verification row is insert-only and records the verifier.
- The evidence rule: two or more bodies, each with a trial paper and a skema, or an LPM format document. A blueprint with unreviewed layer-2 values ("Belum disemak") or incomplete KBAT values cannot pass until an admin reviews or completes them. A blueprint with a single evidence body cannot pass.
- Do not edit a Disahkan blueprint: edit makes a new Spec version; the older Disahkan version keeps serving pupils until the new one is verified (`serves_students` moves to the new head on its Sahkan).
- Admin Pusat in Mod Pelajar may generate from a Spec head (test data); Admin Sekolah and pupils need Disahkan.

State check (read-only):

```sql
-- which active blueprints serve students, and who verified them
SELECT b.code, b.version, b.source, b.serves_students, v.verified_at, v.verified_by_id
  FROM blueprints b LEFT JOIN blueprint_verifications v ON v.id = b.verification_id
 WHERE b.status = 'active' ORDER BY b.code;

-- evidence bodies behind each active blueprint
SELECT b.code, e.kind, count(*) AS rows, count(DISTINCT e.body) AS bodies
  FROM blueprints b JOIN blueprint_evidence e ON e.blueprint_id = b.id
 WHERE b.status = 'active' GROUP BY b.code, e.kind ORDER BY b.code, e.kind;
```

Smoke: a pupil of the verified subject calls Jana Kertas (`POST /api/bijak/papers/generate`): 201, or 422 `SHORTAGE` if the question pool of that subject is short (that is a pool answer, not a blueprint one). 422 `NO_BLUEPRINT` means the blueprint is not serving yet.

## 6. Environment

Set on the API service before it starts (examples in `.env.api.example`; no secret goes in the repo):

| Variable | Value for R1 | Meaning |
|---|---|---|
| `BIJAK_POC_QUESTIONS` | `false` on UAT and production | `true` serves the reserved PoC id block (seeded PoC papers, Jana pool), for staging / dev / e2e only. `false` (the default) serves question-bank questions only. |
| `OCR_ENGINE` | `none` (default) or `tesseract` | `none`: scanned pages end as `OCR_UNAVAILABLE`. `tesseract`: tesseract.js with local language data, never downloads; then `OCR_LANG_DIR` must be an absolute folder holding `msa.traineddata` and `eng.traineddata`. |
| `OCR_LANG_DIR` | empty, or the folder above | Required only with `OCR_ENGINE=tesseract`. |
| `ALLOW_DEMO_SEED` | unset / `false` | Never `true` in production. Demo seeds (including the E2E seed) are skipped in production. |
| `E2E_SEED` | never set on a server | Local / E2E only, with `--profile=e2e` (section 7). |

## 7. Local / E2E seed (never on a server)

For local stacks and the E2E suite only, behind two keys (`--profile=e2e` and `E2E_SEED=1`), default off. It creates a Tingkatan 4 pupil, an Admin Pusat and moves one launch blueprint to Disahkan through the same checks as Sahkan. Command, accounts and the blueprint it picks: [e2e-seed.md](e2e-seed.md).

```
E2E_SEED=1 npm run be:db:seed -- --profile=e2e
```

## 8. If something goes wrong

| Symptom | Likely cause | Action |
|---|---|---|
| After deploy nothing is served in practice, login count 0 | API/FE build older than 0100 (still reads `published`) | Deploy the matching build; run 3.2 and 3.4. |
| A write fails with a CHECK violation on `ck_question_versions_status` | An old API instance still running | Stop old instances. |
| Pupil Jana Kertas answers 422 `NO_BLUEPRINT` | The blueprint is still Spec after 0092 | Section 5. |
| DSKP load exit code 1 | One subject failed; its transaction rolled back | Read the report, fix, re-run (finished subjects report `same`). |
| 0092 aborts on `topic_weights` | A row holds a value | Take the value out first (the guard prevents silent loss); see the migration header. |
| Need to go back past 0100 | 0100 is not reversible | Restore the dump together with the previous API/FE build. |
