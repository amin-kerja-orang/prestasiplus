-- AZ-31 (BE-18 owner; half AM's REQUEST on #109, LEAD decision Q4 A, 21 Oct): migrated teacher question-set headers are
-- kept with `needs_rebuild = true` and no items. .cloud sets have no classroom (v2-data-migration.md), so a migrated header
-- has no class. Every row born in v2 still needs one: the check allows a NULL class only for a migrated header
-- (`legacy_source` set and `needs_rebuild` true).
--
-- The foreign key `fk_question_sets_classroom_id`, the index `ix_question_sets_classroom_id_status`, `uq_question_sets_legacy`
-- and the other checks stay valid (a NULL foreign key is not checked). Readers: a set without a class is never listed to a
-- student and never resolves for practice (BE-18 `QuestionSetsService`), until it is rebuilt into a class.
--
-- Reversible (only while no row has a NULL class):
--   ALTER TABLE "question_sets" DROP CONSTRAINT "ck_question_sets_classroom_or_migrated";
--   ALTER TABLE "question_sets" ALTER COLUMN "classroom_id" SET NOT NULL;

ALTER TABLE "question_sets" ALTER COLUMN "classroom_id" DROP NOT NULL;

ALTER TABLE "question_sets" ADD CONSTRAINT "ck_question_sets_classroom_or_migrated"
  CHECK ("classroom_id" IS NOT NULL OR ("legacy_source" IS NOT NULL AND "needs_rebuild" = true));
