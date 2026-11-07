-- S6-T14 (DM-46, D-A7, R1-GUR-8b): a Set Soalan is assigned to explicitly selected classes.
--  1. New table question_set_classrooms (one row per set and class); a published set is visible only to pupils
--     enrolled in one of its classes, a set without a row is a draft with no class.
--  2. Backfill: one row per existing set that has question_sets.classroom_id (assigned_by = the set's teacher).
--  3. Drop ck_question_sets_classroom_or_migrated (a draft has no class; "publish needs a class" is a service rule).
--     The column question_sets.classroom_id stays (nullable, unused for new sets; dropped in a later release).
--  4. question_sets.education_level_id (nullable, "Tingkatan (pilihan)").
--  5. Index practice_sessions (question_set_id, status): the edit lock, "siap" counts and results read sessions by set.
--     (practice_sessions belongs to S5: additive index only, no column change.)
-- Seeds and fixtures hold no `scheduled` question set (migrated headers are all drafts), so no status conversion is needed here.
-- rollback (only while no set has two classes or a NULL classroom_id):
--   DROP INDEX "ix_practice_sessions_question_set_id_status";
--   ALTER TABLE "question_sets" DROP COLUMN "education_level_id";
--   ALTER TABLE "question_sets" ADD CONSTRAINT "ck_question_sets_classroom_or_migrated"
--     CHECK ("classroom_id" IS NOT NULL OR ("legacy_source" IS NOT NULL AND "needs_rebuild" = true));
--   DROP TABLE "question_set_classrooms";

-- CreateTable
CREATE TABLE "question_set_classrooms" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "question_set_id" BIGINT NOT NULL,
    "classroom_id" BIGINT NOT NULL,
    "assigned_by" BIGINT NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_set_classrooms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_question_set_classrooms_set_id_classroom_id" ON "question_set_classrooms"("question_set_id", "classroom_id");
CREATE INDEX "ix_question_set_classrooms_classroom_id" ON "question_set_classrooms"("classroom_id");

ALTER TABLE "question_set_classrooms" ADD CONSTRAINT "fk_question_set_classrooms_question_set_id" FOREIGN KEY ("question_set_id") REFERENCES "question_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_set_classrooms" ADD CONSTRAINT "fk_question_set_classrooms_classroom_id" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_set_classrooms" ADD CONSTRAINT "fk_question_set_classrooms_assigned_by" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill (idempotent: the unique index makes a second run a no-op).
INSERT INTO "question_set_classrooms" ("question_set_id", "classroom_id", "assigned_by", "assigned_at")
SELECT s."id", s."classroom_id", s."teacher_id", s."created_at"
  FROM "question_sets" s
 WHERE s."classroom_id" IS NOT NULL
ON CONFLICT ("question_set_id", "classroom_id") DO NOTHING;

ALTER TABLE "question_sets" DROP CONSTRAINT IF EXISTS "ck_question_sets_classroom_or_migrated";

ALTER TABLE "question_sets" ADD COLUMN IF NOT EXISTS "education_level_id" BIGINT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_question_sets_education_level_id') THEN
    ALTER TABLE "question_sets" ADD CONSTRAINT "fk_question_sets_education_level_id" FOREIGN KEY ("education_level_id") REFERENCES "education_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
CREATE INDEX IF NOT EXISTS "ix_question_sets_education_level_id" ON "question_sets"("education_level_id");

CREATE INDEX IF NOT EXISTS "ix_practice_sessions_question_set_id_status" ON "practice_sessions"("question_set_id", "status");
