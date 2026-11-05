-- S3 range, requested by S1-T10 (DM-45, D-A2): an accepted intake batch becomes a draft paper. `papers.source_batch_id` points at
-- the batch the paper was imported from (null for every other paper); deleting the batch keeps the paper (ON DELETE SET NULL).
-- `papers.paper_code` already exists (not added here). The partial unique index makes "one draft paper per batch and paper code"
-- a database rule, so a second accept updates the draft instead of creating another. No backfill.
-- The FK is added NOT VALID then VALIDATEd (short lock); the column is nullable so there is no table rewrite.
-- Reversible: the down step (below, as a comment) drops the index, the constraint and the column.

ALTER TABLE "papers" ADD COLUMN "source_batch_id" BIGINT;

ALTER TABLE "papers" ADD CONSTRAINT "fk_papers_source_batch_id" FOREIGN KEY ("source_batch_id") REFERENCES "intake_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "papers" VALIDATE CONSTRAINT "fk_papers_source_batch_id";

CREATE UNIQUE INDEX "uq_papers_source_batch_id_paper_code" ON "papers"("source_batch_id", "paper_code") WHERE "source_batch_id" IS NOT NULL;

-- Down (manual):
--   DROP INDEX "uq_papers_source_batch_id_paper_code";
--   ALTER TABLE "papers" DROP CONSTRAINT "fk_papers_source_batch_id";
--   ALTER TABLE "papers" DROP COLUMN "source_batch_id";
