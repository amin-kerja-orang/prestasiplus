-- S5-T15 (DM-44): practice_checks.selected_label may hold the comma-joined, sorted labels of an `mcq_multi` answer (for example 'A,C'), as docs/prd/r1/46-pupil-activity-flow.md says.
-- The check now allows NULL or one to eight letters A-H separated by single commas; a single letter stays valid.
-- Reversible: the down step (below, as a comment) re-creates the old check. It applies only while no multi-label row exists (a row like 'A,C' makes it fail).
--   ALTER TABLE "practice_checks" DROP CONSTRAINT "ck_practice_checks_selected_label";
--   ALTER TABLE "practice_checks" ADD CONSTRAINT "ck_practice_checks_selected_label" CHECK ("selected_label" ~ '^[A-H]$');

ALTER TABLE "practice_checks" DROP CONSTRAINT "ck_practice_checks_selected_label";
ALTER TABLE "practice_checks" ADD CONSTRAINT "ck_practice_checks_selected_label" CHECK ("selected_label" IS NULL OR "selected_label" ~ '^[A-H](,[A-H]){0,7}$');
