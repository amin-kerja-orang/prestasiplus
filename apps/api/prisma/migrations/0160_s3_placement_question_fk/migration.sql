-- S3-T02 (DM-11, INV-13, FR-X1-4e): paper_placements.question_id gets the foreign key that 0012 left to "the integrator". ON DELETE RESTRICT: a hard
-- delete of a placed question is refused by the database, it can no longer silently orphan a published paper.
-- NOT VALID first (new rows are checked at once, the brief lock is only for the catalogue), then the orphan report as a NOTICE, then VALIDATE.
-- An orphan stops VALIDATE, and the migration fails with the row named by Postgres; nothing is deleted or repaired here. To run the report on its own,
-- read-only, before deploying:
--   SELECT pl.id AS placement_id, pl.paper_section_id, pl.question_id
--   FROM paper_placements pl LEFT JOIN questions q ON q.id = pl.question_id
--   WHERE q.id IS NULL ORDER BY pl.id;
-- Prisma keeps no relation for it (the builder never joins the question tables; the schema file header says so).
-- rollback: ALTER TABLE "paper_placements" DROP CONSTRAINT "fk_paper_placements_question_id";

ALTER TABLE "paper_placements"
  ADD CONSTRAINT "fk_paper_placements_question_id" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT NOT VALID;

DO $$
DECLARE
  orphans bigint;
BEGIN
  SELECT count(*) INTO orphans FROM paper_placements pl WHERE NOT EXISTS (SELECT 1 FROM questions q WHERE q.id = pl.question_id);
  RAISE NOTICE '0160 orphan report: % paper_placements row(s) point at no question', orphans;
END $$;

ALTER TABLE "paper_placements" VALIDATE CONSTRAINT "fk_paper_placements_question_id";
