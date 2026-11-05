-- S5-T15 part 1, DM-44 (single answer store): practice_answers gets mode, attempt_id, part_ref, marks_awarded,
-- marks_max, all NULLABLE, so the two direct writers of practice_repository keep working until they move to
-- AnswerLogPort. Part 2 (0188_s5_answer_store_validate) runs VALIDATE CONSTRAINT ck_practice_answers_mode and
-- SET NOT NULL on mode, once the "no write outside the port" allow-list is empty.
-- is_test already exists on practice_answers (not added). Also widens ck_practice_sessions_mode to 12 values.
--
-- DDL ONLY: no data is rewritten here, so `mode` stays NULL on every pre-existing row. The legacy backfill (the
-- session's mode; 'latih_tubi' for a row without a session) is U-OP-20: `scripts/uat-ops/backfill-bijak-answers.ts
-- --legacy-mode [--apply]`. It must be re-run right before part 2's 0188 (VALIDATE + NOT NULL).
--
-- Validation: the re-created ck_practice_sessions_mode is validated in place (plain ADD CONSTRAINT scans the table;
-- practice_sessions is small). ck_practice_answers_mode is NOT VALID on purpose (practice_answers is large).
--
-- Reversible: undo by hand, in this order:
--   DROP INDEX "uq_practice_answers_attempt_key";
--   ALTER TABLE "practice_answers" DROP CONSTRAINT "ck_practice_answers_mode";
--   ALTER TABLE "practice_answers" DROP COLUMN "mode", DROP COLUMN "attempt_id", DROP COLUMN "part_ref",
--     DROP COLUMN "marks_awarded", DROP COLUMN "marks_max";
--   ALTER TABLE "practice_sessions" DROP CONSTRAINT "ck_practice_sessions_mode";
--   ALTER TABLE "practice_sessions" ADD CONSTRAINT "ck_practice_sessions_mode" CHECK ("mode" IN (
--     'random', 'chapter', 'revision', 'past_year', 'latih_tubi', 'ramalan', 'mission', 'remedial', 'question_set', 'pksk'));
-- (Move or delete any practice_sessions row with mode 'databank' or 'tracking_a' first, or the ADD CONSTRAINT fails.)

ALTER TABLE "practice_answers"
  ADD COLUMN "mode" TEXT,
  ADD COLUMN "attempt_id" UUID,
  ADD COLUMN "part_ref" TEXT,
  ADD COLUMN "marks_awarded" NUMERIC(6,2),
  ADD COLUMN "marks_max" NUMERIC(6,2);

-- The 19 values of the registry (OPT-MODE-SESI); NULL passes until part 2. NOT VALID: no table scan here.
ALTER TABLE "practice_answers"
  ADD CONSTRAINT "ck_practice_answers_mode" CHECK ("mode" IS NULL OR "mode" IN (
    'random', 'chapter', 'revision', 'past_year', 'latih_tubi', 'ramalan', 'mission', 'remedial', 'question_set', 'pksk',
    'databank', 'kuiz', 'simulasi', 'tracking_a', 'subjektif', 'structured', 'battle', 'audio_kbat', 'game'
  )) NOT VALID;

-- Idempotency key of AnswerLogPort.record (a NULL part_ref reads as '').
CREATE UNIQUE INDEX "uq_practice_answers_attempt_key"
  ON "practice_answers" ("attempt_id", "user_id", "question_id", (coalesce("part_ref", '')))
  WHERE "attempt_id" IS NOT NULL;

-- Sessions: 10 existing values + databank, tracking_a.
ALTER TABLE "practice_sessions" DROP CONSTRAINT "ck_practice_sessions_mode";
ALTER TABLE "practice_sessions" ADD CONSTRAINT "ck_practice_sessions_mode" CHECK ("mode" IN (
  'random', 'chapter', 'revision', 'past_year', 'latih_tubi', 'ramalan', 'mission', 'remedial', 'question_set', 'pksk',
  'databank', 'tracking_a'
));
