-- S1-T03 (part: upload header and carry), DM-85 / PO decision item 2: the exam board (negeri or badan peperiksaan) declared at upload.
-- intake_batches.exam_board (nullable, max 100). Extraction copies it to source_papers.exam_board.
--
-- Down (manual):
--   ALTER TABLE "intake_batches" DROP CONSTRAINT "ck_intake_batches_exam_board";
--   ALTER TABLE "intake_batches" DROP COLUMN "exam_board";

ALTER TABLE "intake_batches" ADD COLUMN "exam_board" TEXT;
ALTER TABLE "intake_batches" ADD CONSTRAINT "ck_intake_batches_exam_board" CHECK ("exam_board" IS NULL OR char_length("exam_board") BETWEEN 1 AND 100);
