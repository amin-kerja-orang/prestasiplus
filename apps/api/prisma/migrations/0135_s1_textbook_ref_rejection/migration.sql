-- S1-T02, DM-56 and DM-58, two nullable columns on `question_versions`:
--   textbook_ref     jsonb: the "Rujukan buku teks" {bab, tingkatan, mukaSurat, hingga?}. The int columns textbook_bab / textbook_tingkatan /
--                    textbook_page stay and are written together with it.
--   rejection_reason text, 5 to 500 characters after trimming: why an admin sent the version back from Semakan to Draf ("Ditolak").
--                    Cleared when the version is sent for review again.
-- Catalogue-only changes (no default, no rewrite). No down file (Prisma migrations are forward-only); to revert by hand, drop the check and the two columns.
ALTER TABLE "question_versions" ADD COLUMN "textbook_ref" JSONB;
ALTER TABLE "question_versions" ADD COLUMN "rejection_reason" TEXT;
ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_rejection_reason"
  CHECK ("rejection_reason" IS NULL OR char_length(btrim("rejection_reason")) BETWEEN 5 AND 500) NOT VALID;
-- Validated in a second step (SHARE UPDATE EXCLUSIVE), as 0103 and 0105, so the table is not scanned under ACCESS EXCLUSIVE.
ALTER TABLE "question_versions" VALIDATE CONSTRAINT "ck_question_versions_rejection_reason";
