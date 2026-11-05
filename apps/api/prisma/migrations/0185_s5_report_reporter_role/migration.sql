-- S5-T06 (DM-82, FR-MUR-54-*): question_reports gains `reporter_role` ('murid' | 'guru'), the role the report was filed under.
-- New rows get it from the session role. Existing rows are backfilled: a reporter who holds the teacher role and NOT the student
-- role reported as 'guru'; everyone else (student only, both roles, no role row left) stays 'murid' (the column default).
-- The constraint is added NOT VALID then VALIDATEd (short lock).
-- Reversible: the down step (below, as a comment) drops the constraint and the column.
--   ALTER TABLE "question_reports" DROP CONSTRAINT "ck_question_reports_reporter_role";
--   ALTER TABLE "question_reports" DROP COLUMN "reporter_role";

ALTER TABLE "question_reports" ADD COLUMN "reporter_role" TEXT NOT NULL DEFAULT 'murid';

UPDATE "question_reports" qr
SET "reporter_role" = 'guru'
WHERE qr."reporter_id" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "user_roles" ur WHERE ur."user_id" = qr."reporter_id" AND ur."role" = 'teacher')
  AND NOT EXISTS (SELECT 1 FROM "user_roles" ur WHERE ur."user_id" = qr."reporter_id" AND ur."role" = 'student');

ALTER TABLE "question_reports" ADD CONSTRAINT "ck_question_reports_reporter_role" CHECK ("reporter_role" IN ('murid', 'guru')) NOT VALID;
ALTER TABLE "question_reports" VALIDATE CONSTRAINT "ck_question_reports_reporter_role";
