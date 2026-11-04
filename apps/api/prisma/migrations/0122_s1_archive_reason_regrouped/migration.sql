-- 0122_s1_archive_reason_regrouped
-- Purpose: widen question_versions.archive_reason with the value 'regrouped' (DM-06, card S1-T01). The value is used by the regroup
-- work-list of S2-T04 / S4-T04. Widening only: every existing row stays valid.
-- Method: add the wider check under a temporary name NOT VALID, VALIDATE it (no long ACCESS EXCLUSIVE scan), drop the old check, rename.
-- Reversible: re-add the three-value check the same way (superseded, withdrawn, source_takedown) after clearing 'regrouped' rows.

ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_archive_reason_v2"
  CHECK ("archive_reason" IS NULL OR "archive_reason" IN ('superseded', 'withdrawn', 'source_takedown', 'regrouped')) NOT VALID;
ALTER TABLE "question_versions" VALIDATE CONSTRAINT "ck_question_versions_archive_reason_v2";
ALTER TABLE "question_versions" DROP CONSTRAINT "ck_question_versions_archive_reason";
ALTER TABLE "question_versions" RENAME CONSTRAINT "ck_question_versions_archive_reason_v2" TO "ck_question_versions_archive_reason";
