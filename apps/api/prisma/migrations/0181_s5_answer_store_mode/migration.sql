-- S5-T15 part 1, DM-44 (single answer store): practice_answers gets mode, attempt_id, part_ref, marks_awarded,
-- marks_max, all NULLABLE, so the two direct writers of practice_repository keep working until they move to
-- AnswerLogPort. Part 2 (0188_s5_answer_store_validate) runs VALIDATE CONSTRAINT ck_practice_answers_mode and
-- SET NOT NULL on mode, once the "no write outside the port" allow-list is empty.
-- is_test already exists on practice_answers (not added). Also widens ck_practice_sessions_mode to 12 values.

ALTER TABLE "practice_answers"
  ADD COLUMN "mode" TEXT,
  ADD COLUMN "attempt_id" UUID,
  ADD COLUMN "part_ref" TEXT,
  ADD COLUMN "marks_awarded" NUMERIC(6,2),
  ADD COLUMN "marks_max" NUMERIC(6,2);

-- Backfill: the session's mode; 'latih_tubi' for a row without a session.
UPDATE "practice_answers" a
   SET "mode" = s."mode"
  FROM "practice_sessions" s
 WHERE a."session_id" = s."id" AND a."mode" IS NULL;

UPDATE "practice_answers" SET "mode" = 'latih_tubi' WHERE "mode" IS NULL AND "session_id" IS NULL;

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
