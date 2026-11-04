-- S1-T01 part 1, DM-02(a): a stimulus group that still has members can no longer be deleted by the database. `fk_questions_group_id` changes from
-- ON DELETE SET NULL to ON DELETE RESTRICT (ON UPDATE CASCADE kept). Before, deleting such a group nulled only `group_id` and then failed the
-- `ck_questions_group_position` check with a raw check violation; now the delete fails with a foreign key violation (23503) and the service answers
-- 409. Members must be released (group_id and group_position set to null) before the group row is deleted; StimuliService.deleteGroup already does that.
-- Safe sequence for a large table: the new FK is added NOT VALID (no full scan under a long lock), validated (SHARE UPDATE EXCLUSIVE only),
-- then the old FK is dropped and the new one takes its name. No data change. Reversible: the down step is the same swap back to ON DELETE SET NULL.
ALTER TABLE "questions" ADD CONSTRAINT "fk_questions_group_id_restrict" FOREIGN KEY ("group_id") REFERENCES "stimulus_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "questions" VALIDATE CONSTRAINT "fk_questions_group_id_restrict";
ALTER TABLE "questions" DROP CONSTRAINT "fk_questions_group_id";
ALTER TABLE "questions" RENAME CONSTRAINT "fk_questions_group_id_restrict" TO "fk_questions_group_id";
