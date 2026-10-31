# R1-B01: question lifecycle "approved = servable" (migration 0100)

Spec: ADR-0027, `docs/architecture/v2-admin-student-pipeline.md` section 7 and 13.4 (R1-B01), TRACKER D80 DEC-1, D85 U2.

## What changes in the database

Migration `apps/api/prisma/migrations/0100_question_lifecycle_approved/migration.sql` (one transaction):

1. `question_versions.status = 'approved'` (approved, never published, invisible to pupils today) becomes `review`.
2. `question_versions.status = 'published'` (live, served today) becomes `approved` (still served).
3. `ck_question_versions_status` is replaced: allowed values are `draft`, `review`, `approved`, `archived`.
4. The partial indexes whose predicate was `status = 'published'` are rebuilt on `status = 'approved'`:
   `uq_question_versions_one_published` -> `uq_question_versions_one_approved`,
   `ix_question_versions_published_subject_level` -> `ix_question_versions_approved_subject_level`,
   `ix_qv_pub_subject_level_tp`, `ix_qv_pub_chapter`, `ix_qv_pub_level_tp` (same names, new predicate).

Decisions:

- `published` is removed from `question_versions` (no legacy alias kept: nothing needs it, and a CHECK that still allowed it would let old code write it silently).
- `question_status_events` keeps `published` in its two CHECKs: those rows are history and are not rewritten. New code never writes it.
- `question_versions.published_at` keeps its name and now means "approved at" (ADR-0027 point 6).
- `questions.live_version_no` is unchanged (it already points at the formerly published version).
- Papers keep their own `published` status (`papers.status`); this migration does not touch them.
- Not reversible: after step 1 "approved but unpublished" cannot be told apart from "was review".

## Pre-flight (run on the target database BEFORE deploying)

Take a dump first (`docs/ops/db-backup.md`). Then record:

```sql
-- version counts by status (expect only draft, review, approved, published, archived)
SELECT status, count(*) FROM question_versions GROUP BY status ORDER BY status;

-- rows that go back to review (approved but not published): these become invisible-until-Terbitkan
SELECT count(*) AS approved_to_review FROM question_versions WHERE status = 'approved';

-- rows that become approved (currently served)
SELECT count(*) AS published_to_approved FROM question_versions WHERE status = 'published';

-- live pointers: how many questions are live today
SELECT count(*) AS live_questions FROM questions WHERE live_version_no IS NOT NULL;

-- sanity: a live pointer must point at a published version (expect 0 rows; if not, investigate before migrating)
SELECT q.id FROM questions q
  JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
 WHERE v.status <> 'published' LIMIT 20;
```

The migration also prints `0100 pre-flight` and `0100 post` NOTICE lines with the counts (visible in the migrate log).

## Verification (run AFTER the migration and AFTER the new API is deployed)

```sql
-- 1. only four statuses remain
SELECT status, count(*) FROM question_versions GROUP BY status ORDER BY status;
--    expect: no 'published'; approved = old published; review = old review + old approved

-- 2. counts match the pre-flight
--    approved_after = published_before ; review_after = review_before + approved_before

-- 3. every live pointer is on an approved version (expect 0 rows)
SELECT q.id FROM questions q
  JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
 WHERE v.status <> 'approved' LIMIT 20;

-- 4. at most one approved version per question (expect 0 rows)
SELECT question_id FROM question_versions WHERE status = 'approved' GROUP BY 1 HAVING count(*) > 1;

-- 5. the new indexes exist and use the new predicate
SELECT indexname, indexdef FROM pg_indexes
 WHERE tablename = 'question_versions' AND indexdef LIKE '%WHERE%' ORDER BY indexname;
--    every predicate must read status = 'approved'; no index may mention 'published'

-- 6. nothing visible to pupils appeared by accident: the served count equals the old live count
SELECT count(*) FROM questions q
  JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no AND v.status = 'approved'
 WHERE q.is_active;
```

Then in the admin UI: a question in `review` shows the button "Terbitkan"; pressing it makes the question appear in practice at once (no second hop).

## Deploy notes

- Deploy order: migration 0100 and the API/FE build of this change in the same release (a few seconds of mixed state is possible: an old API against the new CHECK would fail to write `published`; a new API against the old data would serve nothing). Use the maintenance window.
- Rolling back the code after the first new approval is possible only together with a database restore (the migration is not reversible).
- Code that is outside this change and still names `'published'` for a question status will break (no rows served, or a CHECK violation on write). The remaining spots were changed in the follow-up (T04): practice (`be09-practice-question-source`, `structured.service`, `overview`, `writes/listing`, `analytics` repositories), account (`QUESTION_COUNT_SQL`), Bijak (`be09-question-source`, `pool-source` `excludedBankQuery`, `kuiz.service`), the paper builder (`bankQuery`, `SERVABLE_QUESTION_STATUSES` now `['approved']`) and the m28 admin wire mapping (`approved` is Terbit, `review` is Semakan). Paper `published` (Terbit) is untouched.
- D91: the practice card (`OverviewRepository.bankMatrix`) counts ungrouped questions only (`q.group_id IS NULL`), the hub / draw rule. On the demo seed the BM card is 50 (it was 53 with the 3 SEED-GRP-PASAR group MCQs); the login count (`QUESTION_COUNT_SQL`) still counts group members (493).
- The old `published` bulk action name is still accepted as an input alias of `approved` for one release (`parseBulk`), and answers never contain it.
- New environment variables: none.
