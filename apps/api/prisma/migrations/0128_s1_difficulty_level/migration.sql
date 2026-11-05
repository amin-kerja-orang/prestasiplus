-- S1-T02, DM-47: `difficulty_level` is the typed Kesukaran (1..5) of a question version, separate from `difficulty_tp` (the TP, 1..6).
-- Nullable: legacy rows stay NULL until the U-OP-19 backfill (scripts/uat-ops/difficulty-level-backfill.ts) runs; readers fall back to
-- least(5, difficulty_tp), else 3. Adding a nullable column with no default is a catalogue-only change. No down file (Prisma migrations are
-- forward-only); to revert by hand: ALTER TABLE "question_versions" DROP CONSTRAINT "ck_question_versions_difficulty_level", DROP COLUMN "difficulty_level".
ALTER TABLE "question_versions" ADD COLUMN "difficulty_level" SMALLINT;
ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_difficulty_level"
  CHECK ("difficulty_level" IS NULL OR "difficulty_level" BETWEEN 1 AND 5) NOT VALID;
-- Validated in a second step (SHARE UPDATE EXCLUSIVE), as 0103 and 0105, so the table is not scanned under ACCESS EXCLUSIVE.
ALTER TABLE "question_versions" VALIDATE CONSTRAINT "ck_question_versions_difficulty_level";
