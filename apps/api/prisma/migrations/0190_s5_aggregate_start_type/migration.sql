-- R1 S3-T06 (DM-83, cross-sector S5, requested on #468 and accepted by team-bb): the performance aggregate keeps the attempt
-- kind as `start_type` (= `exam_attempts.paper_kind`, AC-33.4). Migration 0165 widened the attempt kind to `subjektif` (Kertas
-- Subjektif, S3-T06) and `structured` (Soalan Berstruktur, S5-T11), so this check follows. Existing rows satisfy it; no data change.
--
-- Reversible (only while no row uses the new values):
--   ALTER TABLE "practice_attempt_aggregates" DROP CONSTRAINT "ck_practice_attempt_aggregates_start_type";
--   ALTER TABLE "practice_attempt_aggregates" ADD CONSTRAINT "ck_practice_attempt_aggregates_start_type"
--     CHECK ("start_type" IS NULL OR "start_type" IN ('pilihan', 'jana'));

ALTER TABLE "practice_attempt_aggregates" DROP CONSTRAINT IF EXISTS "ck_practice_attempt_aggregates_start_type";
ALTER TABLE "practice_attempt_aggregates" ADD CONSTRAINT "ck_practice_attempt_aggregates_start_type"
  CHECK ("start_type" IS NULL OR "start_type" IN ('pilihan', 'jana', 'subjektif', 'structured'));
