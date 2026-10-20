-- BE-12 follow-up (LEAD decision 4, 2026-10-20 16:00): school_id snapshot on the US-33 attempt aggregate.
-- Additive only. A separate migration rather than an edit of 0014_practice_write, so #42 / #46 do not
-- change while they are under verify (deviations log, 2026-10-20 row "school_id snapshot on aggregate").
-- Number 0018 is proposed (after 0017 BE-10); the LEAD may renumber.
--
-- `school_id` is the student's school AT WRITE TIME (`users.school_id`, BE-05). It is a snapshot: a later
-- school move never rewrites old rows. NULL for a student with no school. ON DELETE SET NULL keeps the
-- sitting when a school is removed (users.school_id is RESTRICT, so in practice only after every user left).
--
-- Reversible: DROP INDEX "ix_practice_attempt_aggregates_school_id_subject_code_submitted_at";
--   ALTER TABLE "practice_attempt_aggregates" DROP COLUMN "school_id";

-- AlterTable
ALTER TABLE "practice_attempt_aggregates" ADD COLUMN "school_id" BIGINT;

-- AddForeignKey
ALTER TABLE "practice_attempt_aggregates" ADD CONSTRAINT "fk_practice_attempt_aggregates_school_id" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: rows written before this migration take the student's CURRENT school (the best value
-- available; the snapshot starts with this migration).
UPDATE "practice_attempt_aggregates" a
SET "school_id" = u."school_id"
FROM "users" u
WHERE u."id" = a."user_id" AND a."school_id" IS NULL AND u."school_id" IS NOT NULL;

-- CreateIndex (school-scoped reports, BE-19 / BE-21; test rows are never read there)
CREATE INDEX "ix_practice_attempt_aggregates_school_id_subject_code_submitted_at" ON "practice_attempt_aggregates"("school_id", "subject_code", "submitted_at" DESC) WHERE NOT "is_test";
