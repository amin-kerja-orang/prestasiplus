-- S1-T08 (DM-72, Q-12, GUR-44): Kiriman Guru. A teacher's question paper upload becomes an intake batch the admin sees in
-- "Kiriman Guru". intake_batches gains `source` ('admin' | 'guru'); a guru batch has a free-text subject (1-100 chars), no
-- kertas (nullable) and a paper_type that is one of the 7 OPT-JENIS-HANTARAN slugs. Admin rows keep every existing rule
-- (subject code regex, kertas 1|2). paper_type is widened ADDITIVELY (existing 5 codes stay, no backfill, no rename).
-- Constraints are added NOT VALID then VALIDATEd (short lock), the old ones dropped before the replacement is added.
-- Reversible: the down step (below, as a comment) deletes guru rows, restores the old checks and NOT NULLs, drops `source`.

ALTER TABLE "intake_batches" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE "intake_batches" ADD CONSTRAINT "ck_intake_batches_source" CHECK ("source" IN ('admin', 'guru')) NOT VALID;
ALTER TABLE "intake_batches" VALIDATE CONSTRAINT "ck_intake_batches_source";

ALTER TABLE "intake_batches" ALTER COLUMN "kertas" DROP NOT NULL;
ALTER TABLE "intake_batches" ALTER COLUMN "year" DROP NOT NULL;

ALTER TABLE "intake_batches" DROP CONSTRAINT "ck_intake_batches_subject";
ALTER TABLE "intake_batches" ADD CONSTRAINT "ck_intake_batches_subject" CHECK (
  ("source" = 'admin' AND "subject" ~ '^[A-Z0-9]{2,32}$') OR ("source" = 'guru' AND char_length("subject") BETWEEN 1 AND 100)
) NOT VALID;
ALTER TABLE "intake_batches" VALIDATE CONSTRAINT "ck_intake_batches_subject";

ALTER TABLE "intake_batches" ADD CONSTRAINT "ck_intake_batches_kertas_required" CHECK ("kertas" IS NOT NULL OR "source" = 'guru') NOT VALID;
ALTER TABLE "intake_batches" VALIDATE CONSTRAINT "ck_intake_batches_kertas_required";

ALTER TABLE "intake_batches" DROP CONSTRAINT "ck_intake_batches_paper_type";
ALTER TABLE "intake_batches" ADD CONSTRAINT "ck_intake_batches_paper_type" CHECK (
  "paper_type" IN ('trial', 'general', 'exam', 'exercise_book', 'other', 'umum', 'dskp', 'buku_teks', 'buku_latihan', 'peperiksaan', 'lain')
) NOT VALID;
ALTER TABLE "intake_batches" VALIDATE CONSTRAINT "ck_intake_batches_paper_type";

-- Down (manual):
--   DELETE FROM "intake_batches" WHERE "source" = 'guru';
--   ALTER TABLE "intake_batches" DROP CONSTRAINT "ck_intake_batches_kertas_required";
--   ALTER TABLE "intake_batches" DROP CONSTRAINT "ck_intake_batches_subject";
--   ALTER TABLE "intake_batches" ADD CONSTRAINT "ck_intake_batches_subject" CHECK ("subject" ~ '^[A-Z0-9]{2,32}$');
--   ALTER TABLE "intake_batches" DROP CONSTRAINT "ck_intake_batches_paper_type";
--   ALTER TABLE "intake_batches" ADD CONSTRAINT "ck_intake_batches_paper_type" CHECK ("paper_type" IN ('trial', 'general', 'exam', 'exercise_book', 'other'));
--   ALTER TABLE "intake_batches" ALTER COLUMN "kertas" SET NOT NULL;
--   ALTER TABLE "intake_batches" ALTER COLUMN "year" SET NOT NULL;
--   ALTER TABLE "intake_batches" DROP CONSTRAINT "ck_intake_batches_source";
--   ALTER TABLE "intake_batches" DROP COLUMN "source";
