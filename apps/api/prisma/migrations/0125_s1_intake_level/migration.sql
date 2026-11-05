-- S1-T03 (part: upload header and carry), DM-09 and D2: the level, paper code and set of an intake batch.
--
-- intake_batches gains (all nullable, no backfill; a batch made before this migration has none and falls back to the old behaviour):
--   education_level_id  BIGINT  FK education_levels(id) ON DELETE RESTRICT: the level (T1..T5) of every item of the batch.
--   paper_code          TEXT    CHECK ^[0-9]{4}/[0-9]$ (e.g. 1449/2). A blank code stays NULL (D10a).
--   set_label           TEXT    D2 (U-08 "Set"), max 20.
--
-- Down (manual):
--   ALTER TABLE "intake_batches" DROP CONSTRAINT "ck_intake_batches_set_label";
--   ALTER TABLE "intake_batches" DROP CONSTRAINT "ck_intake_batches_paper_code";
--   DROP INDEX "ix_intake_batches_education_level_id";
--   ALTER TABLE "intake_batches" DROP CONSTRAINT "fk_intake_batches_education_level_id";
--   ALTER TABLE "intake_batches" DROP COLUMN "set_label", DROP COLUMN "paper_code", DROP COLUMN "education_level_id";

ALTER TABLE "intake_batches" ADD COLUMN "education_level_id" BIGINT;
ALTER TABLE "intake_batches" ADD COLUMN "paper_code" TEXT;
ALTER TABLE "intake_batches" ADD COLUMN "set_label" TEXT;

ALTER TABLE "intake_batches" ADD CONSTRAINT "fk_intake_batches_education_level_id" FOREIGN KEY ("education_level_id") REFERENCES "education_levels"("id") ON DELETE RESTRICT;
CREATE INDEX "ix_intake_batches_education_level_id" ON "intake_batches"("education_level_id");
ALTER TABLE "intake_batches" ADD CONSTRAINT "ck_intake_batches_paper_code" CHECK ("paper_code" IS NULL OR "paper_code" ~ '^[0-9]{4}/[0-9]$');
ALTER TABLE "intake_batches" ADD CONSTRAINT "ck_intake_batches_set_label" CHECK ("set_label" IS NULL OR char_length("set_label") BETWEEN 1 AND 20);
