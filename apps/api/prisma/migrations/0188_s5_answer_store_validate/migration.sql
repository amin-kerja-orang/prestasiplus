-- S5-T15 part 3, DM-44 (single answer store): validates ck_practice_answers_mode (added NOT VALID in 0181) and sets
-- practice_answers.mode NOT NULL. Ships once the "no write outside the port" allow-list is empty, so every writer
-- (AnswerLogPort, the legacy ETL loader, the demo seed) sets a valid mode.
--
-- Precondition: U-OP-20 (`scripts/uat-ops/backfill-bijak-answers.ts --legacy-mode --apply`) has run on the target
-- database, so no practice_answers.mode is NULL. Otherwise VALIDATE/SET NOT NULL fails and, the migration being one
-- transaction, nothing is changed.
--
-- Reversible: `ALTER TABLE "practice_answers" ALTER COLUMN "mode" DROP NOT NULL;` (the validated check stays valid;
-- it still accepts NULL, so the column can be relaxed without touching the constraint).

ALTER TABLE "practice_answers" VALIDATE CONSTRAINT "ck_practice_answers_mode";
ALTER TABLE "practice_answers" ALTER COLUMN "mode" SET NOT NULL;
