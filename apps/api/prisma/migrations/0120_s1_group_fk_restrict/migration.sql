-- S1-T01 part 1, DM-02(a): a stimulus group that still has members can no longer be deleted by the database. `fk_questions_group_id` changes from
-- ON DELETE SET NULL to ON DELETE RESTRICT (ON UPDATE CASCADE kept). Before, deleting such a group nulled only `group_id` and then failed the
-- `ck_questions_group_position` check with a raw check violation; now the delete fails with a foreign key violation (23503) and the service answers
-- 409. Members must be released (group_id and group_position set to null) before the group row is deleted; StimuliService.deleteGroup already does that.
-- Sequence: the new FK is added NOT VALID, validated, then the old FK is dropped and the new one takes its name. The file runs in one
-- transaction, so writes to `questions` wait until the validation scan ends (short on the current table size). No data change. No down file (Prisma migrations are forward-only); to revert by hand, swap the FK back to ON DELETE SET NULL the same way.
ALTER TABLE "questions" ADD CONSTRAINT "fk_questions_group_id_restrict" FOREIGN KEY ("group_id") REFERENCES "stimulus_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "questions" VALIDATE CONSTRAINT "fk_questions_group_id_restrict";
ALTER TABLE "questions" DROP CONSTRAINT "fk_questions_group_id";
ALTER TABLE "questions" RENAME CONSTRAINT "fk_questions_group_id_restrict" TO "fk_questions_group_id";
