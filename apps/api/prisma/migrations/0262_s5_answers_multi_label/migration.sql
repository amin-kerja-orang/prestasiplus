-- S5-T15 (DM-44): practice_answers.selected_label may hold the comma-joined, sorted labels of an `mcq_multi` answer (for example 'A,C'), as docs/prd/r1/46-pupil-activity-flow.md says. It mirrors 0261 (practice_checks).
-- The check now allows NULL or one to eight letters A-H separated by single commas; a single letter stays valid.
-- Lock: DROP CONSTRAINT and ADD CONSTRAINT take a short ACCESS EXCLUSIVE lock on practice_answers; ADD is NOT VALID so it scans nothing, then VALIDATE takes only SHARE UPDATE EXCLUSIVE (reads and writes continue) while it scans the table.
-- Reversible: the down step (below, as a comment) re-creates the old check. It applies only while no multi-label row exists (a row like 'A,C' makes it fail).
--   ALTER TABLE "practice_answers" DROP CONSTRAINT "ck_practice_answers_selected_label";
--   ALTER TABLE "practice_answers" ADD CONSTRAINT "ck_practice_answers_selected_label" CHECK ("selected_label" IS NULL OR "selected_label" ~ '^[A-H]$');

ALTER TABLE "practice_answers" DROP CONSTRAINT "ck_practice_answers_selected_label";
ALTER TABLE "practice_answers" ADD CONSTRAINT "ck_practice_answers_selected_label" CHECK ("selected_label" IS NULL OR "selected_label" ~ '^[A-H](,[A-H]){0,7}$') NOT VALID;
ALTER TABLE "practice_answers" VALIDATE CONSTRAINT "ck_practice_answers_selected_label";
