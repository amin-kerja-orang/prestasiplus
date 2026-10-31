-- R1-B01 (ADR-0027, D80 DEC-1, D85 U2): `approved` is the only servable question status; `published` is removed.
-- Data change plus constraint and index swap. Runs in the migration transaction.
--
-- Order matters:
--   1. approved but never published (invisible to pupils today) -> review, so it stays invisible until an admin approves it;
--   2. published (live, served today) -> approved, so it keeps serving;
--   3. replace the status CHECK with draft/review/approved/archived;
--   4. rebuild the partial indexes whose predicate was status = 'published' (0011, 0044) on status = 'approved'.
--      Without step 4 every learner draw would lose its partial index (hundreds of thousands of live rows).
--
-- `question_versions.published_at` keeps its name and now means "approved at" (ADR-0027 point 6).
-- `question_status_events` keeps `published` allowed in its two CHECKs: those rows are history and are not rewritten.
-- New code never writes `published` (to or from).
--
-- NOT reversible: after step 1 the set "approved but unpublished" cannot be told apart from "was review". Take a dump first
-- (docs/ops/r1-b01-question-lifecycle.md has the pre-flight counts and the verification queries).

DO $$
DECLARE
  n_pub int; n_appr int; n_total int;
BEGIN
  SELECT count(*) FILTER (WHERE status = 'published'), count(*) FILTER (WHERE status = 'approved'), count(*) INTO n_pub, n_appr, n_total FROM "question_versions";
  RAISE NOTICE '0100 pre-flight: question_versions total=%, published=%, approved=%', n_total, n_pub, n_appr;
END $$;

-- The one-live-version index and the draw indexes still use the old predicate; drop them before the data moves so the
-- 'approved' rows created in step 2 cannot collide with a stale unique index.
DROP INDEX IF EXISTS "uq_question_versions_one_published";
DROP INDEX IF EXISTS "ix_question_versions_published_subject_level";
DROP INDEX IF EXISTS "ix_qv_pub_subject_level_tp";
DROP INDEX IF EXISTS "ix_qv_pub_chapter";
DROP INDEX IF EXISTS "ix_qv_pub_level_tp";

-- The CHECK must allow every value while the data moves, so drop it now and add the new one afterwards.
ALTER TABLE "question_versions" DROP CONSTRAINT "ck_question_versions_status";

-- 1. Approved but not published goes back to review (D85 U2).
UPDATE "question_versions" SET "status" = 'review' WHERE "status" = 'approved';
-- 2. Published becomes approved (still servable).
UPDATE "question_versions" SET "status" = 'approved' WHERE "status" = 'published';

-- 3. Four statuses.
ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_status"
  CHECK ("status" IN ('draft', 'review', 'approved', 'archived'));

-- 4. Indexes on the new predicate (same columns as 0011 and 0044).
CREATE UNIQUE INDEX "uq_question_versions_one_approved" ON "question_versions" ("question_id") WHERE "status" = 'approved';
CREATE INDEX "ix_question_versions_approved_subject_level" ON "question_versions" ("subject_id", "education_level_id") WHERE "status" = 'approved';
CREATE INDEX "ix_qv_pub_subject_level_tp" ON "question_versions" ("subject_id", "education_level_id", "difficulty_tp")
  INCLUDE ("question_id", "type", "chapter_id") WHERE "status" = 'approved';
CREATE INDEX "ix_qv_pub_chapter" ON "question_versions" ("chapter_id")
  INCLUDE ("question_id", "type") WHERE "status" = 'approved';
CREATE INDEX "ix_qv_pub_level_tp" ON "question_versions" ("education_level_id", "difficulty_tp")
  INCLUDE ("question_id", "type") WHERE "status" = 'approved';

DO $$
DECLARE
  n_appr int; n_rev int;
BEGIN
  SELECT count(*) FILTER (WHERE status = 'approved'), count(*) FILTER (WHERE status = 'review') INTO n_appr, n_rev FROM "question_versions";
  RAISE NOTICE '0100 post: approved=%, review=%', n_appr, n_rev;
END $$;
