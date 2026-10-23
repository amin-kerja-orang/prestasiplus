-- QLOAD (LEAD decision A): the approved .cloud MCQs (archive_cloud, status diluluskan, type mcq) are loaded into the v2
-- question bank by `migrate:questions`. This supersedes the "No legacy_* columns" note of 0011_question_bank: `questions`
-- now carries the ETL pair so the load is idempotent (ON CONFLICT (legacy_source, legacy_id)) and `migrate:rollback` can
-- remove it. Versions, parts, options, keys and tags cascade from `questions`.
-- Nullable columns, no table rewrite. NULLs are distinct in the unique index: seeded and v2-born rows never collide.
-- Reversible while no migrated row exists:
--   DROP INDEX "uq_questions_legacy";
--   ALTER TABLE "questions" DROP CONSTRAINT "ck_questions_legacy_source", DROP COLUMN "legacy_id", DROP COLUMN "legacy_source";

ALTER TABLE "questions" ADD COLUMN "legacy_source" TEXT, ADD COLUMN "legacy_id" TEXT;

CREATE UNIQUE INDEX "uq_questions_legacy" ON "questions"("legacy_source", "legacy_id");

ALTER TABLE "questions" ADD CONSTRAINT "ck_questions_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));
