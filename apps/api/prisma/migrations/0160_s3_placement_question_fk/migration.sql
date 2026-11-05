-- S3-T02 (DM-11, INV-13, FR-X1-4e): paper_placements.question_id gets the foreign key that 0012 left to "the integrator". ON DELETE RESTRICT: a hard
-- delete of a placed question is refused by the database, it can no longer silently orphan a published paper.
-- Locks: `prisma migrate deploy` runs this file as one transaction, so SHARE ROW EXCLUSIVE on paper_placements and questions is held from ADD CONSTRAINT through
-- VALIDATE. Writes to both tables wait for the length of the migration.
--
-- Orphans, in order:
--   1. The seeded PoC papers place ids of the reserved block 9000000000 .. 9999999999, which have no question row on a host seeded before this card. Such an id gets the
--      same empty, inactive row the exam seed writes (no version, so the bank still does not know it), and `prisma/seed/exam.ts` then leaves it as it is.
--   2. Any other orphan is real damage and stops the migration with the count. Nothing is deleted or repaired here. Read the rows with section (f) of
--      apps/api/scripts/uat-ops/paper-group-integrity.sql (read-only), which runs before this migration too.
-- Prisma keeps no relation for it (the builder never joins the question tables; the schema file header says so).
-- rollback: ALTER TABLE "paper_placements" DROP CONSTRAINT "fk_paper_placements_question_id"; the stub rows stay (they have no version and the seed reuses them).

ALTER TABLE "paper_placements"
  ADD CONSTRAINT "fk_paper_placements_question_id" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT NOT VALID;

INSERT INTO "questions" ("id", "source_type", "latest_version_no", "is_active") OVERRIDING SYSTEM VALUE
SELECT DISTINCT pl."question_id", 'manual', 1, false
  FROM "paper_placements" pl
 WHERE pl."question_id" >= 9000000000 AND pl."question_id" < 10000000000
   AND NOT EXISTS (SELECT 1 FROM "questions" q WHERE q."id" = pl."question_id")
ON CONFLICT ("id") DO NOTHING;

DO $$
DECLARE
  orphans bigint;
BEGIN
  SELECT count(*) INTO orphans FROM paper_placements pl WHERE NOT EXISTS (SELECT 1 FROM questions q WHERE q.id = pl.question_id);
  IF orphans > 0 THEN
    RAISE EXCEPTION '0160 fk_paper_placements_question_id: % paper_placements row(s) point at no question, outside the reserved PoC ids. Nothing was changed. List them with section (f) of apps/api/scripts/uat-ops/paper-group-integrity.sql.', orphans;
  END IF;
END $$;

ALTER TABLE "paper_placements" VALIDATE CONSTRAINT "fk_paper_placements_question_id";
