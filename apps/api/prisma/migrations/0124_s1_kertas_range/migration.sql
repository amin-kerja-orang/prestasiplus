-- S1-T03 (part: kertas range), DM-08: the intake Kertas domain becomes 1..4.
--
-- 1. ck_intake_batches_kertas (0020) was CHECK (kertas IN (1, 2)); it becomes CHECK (kertas BETWEEN 1 AND 4). Added NOT VALID, then
--    validated. A NULL kertas (guru batch, 0137) still passes: a CHECK is satisfied by NULL; ck_intake_batches_kertas_required (0137) is untouched.
-- 2. The Kertas filter of the admin question list reads the trailing digit of paper_code with substring(... '/([1-4])...'). Postgres matches an
--    expression index by its text (see 0107), so ix_question_versions_paper_kertas is rebuilt with the same widened regex.
--    Plain CREATE INDEX (Prisma runs the file in one transaction): it takes a SHARE lock on question_versions while it builds, as 0107 did.
--
-- Down (manual; first delete or change every intake_batches row with kertas 3 or 4):
--   ALTER TABLE "intake_batches" DROP CONSTRAINT "ck_intake_batches_kertas";
--   ALTER TABLE "intake_batches" ADD CONSTRAINT "ck_intake_batches_kertas" CHECK ("kertas" IN (1, 2));
--   DROP INDEX "ix_question_versions_paper_kertas";
--   CREATE INDEX "ix_question_versions_paper_kertas" ON "question_versions" ((substring("paper_code" from '/([1-3])[[:space:]]*$'))) WHERE "paper_code" IS NOT NULL;

ALTER TABLE "intake_batches" DROP CONSTRAINT "ck_intake_batches_kertas";
ALTER TABLE "intake_batches" ADD CONSTRAINT "ck_intake_batches_kertas" CHECK ("kertas" BETWEEN 1 AND 4) NOT VALID;
ALTER TABLE "intake_batches" VALIDATE CONSTRAINT "ck_intake_batches_kertas";

DROP INDEX "ix_question_versions_paper_kertas";
CREATE INDEX "ix_question_versions_paper_kertas" ON "question_versions" ((substring("paper_code" from '/([1-4])[[:space:]]*$'))) WHERE "paper_code" IS NOT NULL;
