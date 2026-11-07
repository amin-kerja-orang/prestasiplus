-- S1-T04 (DM-71): the batch status `selesai_dengan_ralat` ("Selesai dengan ralat": finished, but at least one page failed and at least one
-- item was extracted) and `intake_files.retry_count` (0..3, the one counter shared by the file retry, the batch retry and `extract` with `pages[]`;
-- the original run is not counted, the 4th retry is refused with ERR-INT-11). Additive: existing rows are valid under the widened check and
-- every file starts at 0. The check is added NOT VALID then VALIDATEd (short lock).
-- Reversible: the down step (below, as a comment) moves `selesai_dengan_ralat` rows to `ready_for_review`, restores the old check, drops the column.

ALTER TABLE "intake_batches" DROP CONSTRAINT "ck_intake_batches_status";
ALTER TABLE "intake_batches" ADD CONSTRAINT "ck_intake_batches_status" CHECK (
  "status" IN ('submitted', 'processing', 'ready_for_review', 'selesai_dengan_ralat', 'failed', 'cancelled')
) NOT VALID;
ALTER TABLE "intake_batches" VALIDATE CONSTRAINT "ck_intake_batches_status";

ALTER TABLE "intake_files" ADD COLUMN "retry_count" SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE "intake_files" ADD CONSTRAINT "ck_intake_files_retry_count" CHECK ("retry_count" BETWEEN 0 AND 3);

-- Down (manual):
--   ALTER TABLE "intake_files" DROP CONSTRAINT "ck_intake_files_retry_count";
--   ALTER TABLE "intake_files" DROP COLUMN "retry_count";
--   UPDATE "intake_batches" SET "status" = 'ready_for_review' WHERE "status" = 'selesai_dengan_ralat';
--   ALTER TABLE "intake_batches" DROP CONSTRAINT "ck_intake_batches_status";
--   ALTER TABLE "intake_batches" ADD CONSTRAINT "ck_intake_batches_status" CHECK ("status" IN ('submitted', 'processing', 'ready_for_review', 'failed', 'cancelled'));
