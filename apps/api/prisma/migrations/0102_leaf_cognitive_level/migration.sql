-- R1-B05 (ADR-0031, D76, D83 D-4): the cognitive level of a LEAF part (Taksonomi Bloom, DSKP), mandatory at the new approval of an
-- SPM-bound question. NULL = not set (legacy rows, drafts). The per-leaf TP is the existing `difficulty_tp` (migration 0092, BJS-06:
-- NULL inherits the version value), so no second TP column is added. The four upper levels are KBAT: `kbat` stays in step with them
-- (the application writes kbat = the level for the four, 'bukan' for mengingat / memahami, when only the level is sent).
--
-- Reversible:
--   ALTER TABLE question_parts DROP CONSTRAINT ck_question_parts_cognitive_level_leaf_only;
--   ALTER TABLE question_parts DROP CONSTRAINT ck_question_parts_cognitive_level;
--   ALTER TABLE question_parts DROP COLUMN cognitive_level;

ALTER TABLE "question_parts" ADD COLUMN "cognitive_level" TEXT;

ALTER TABLE "question_parts" ADD CONSTRAINT "ck_question_parts_cognitive_level"
  CHECK ("cognitive_level" IS NULL OR "cognitive_level" IN ('mengingat', 'memahami', 'mengaplikasi', 'menganalisis', 'menilai', 'mencipta'));
ALTER TABLE "question_parts" ADD CONSTRAINT "ck_question_parts_cognitive_level_leaf_only"
  CHECK ("mode" IS NOT NULL OR "cognitive_level" IS NULL);
