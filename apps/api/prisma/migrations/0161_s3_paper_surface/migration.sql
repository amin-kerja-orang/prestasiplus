-- R1 S3-T06 (DM-23, FR-ADM-Q18.1..8, R1-MUR-13): Kertas Subjektif papers are `papers` rows with `surface = 'subjektif'`.
-- Adds the four DM-23 columns. No backfill: the column default `simulasi` covers every existing row, imported papers included
-- (`exam_board` stays null for them; an admin sets it).
--   exam_board        Negeri or badan (slug of OPT-NEGERI-KERTAS); required by the API for a subjektif paper.
--   surface           simulasi (Set Builder / Simulasi lane) or subjektif (Kertas Subjektif lane).
--   duration_minutes  Tempoh (minit), 0..300; null or 0 = untimed, shown as "—" (PO decision 2026-11-05, item 17).
--   total_marks       Jumlah Markah typed by the admin for a subjektif paper (INV-17); null for Simulasi papers.
-- `printed_duration_min` stays NOT NULL for Simulasi (D115). For a subjektif paper it holds the same value as
-- `duration_minutes`, or 0 when that is null, so `ck_papers_duration` allows 0 for `surface = 'subjektif'` only.
--
-- Reversible:
--   ALTER TABLE "papers" DROP CONSTRAINT "ck_papers_subjektif_duration";
--   ALTER TABLE "papers" DROP CONSTRAINT "ck_papers_duration";
--   ALTER TABLE "papers" ADD CONSTRAINT "ck_papers_duration" CHECK ("printed_duration_min" > 0);
--   ALTER TABLE "papers" DROP COLUMN "exam_board", DROP COLUMN "surface", DROP COLUMN "duration_minutes", DROP COLUMN "total_marks";

ALTER TABLE "papers" ADD COLUMN IF NOT EXISTS "exam_board" TEXT;
ALTER TABLE "papers" ADD COLUMN IF NOT EXISTS "surface" TEXT NOT NULL DEFAULT 'simulasi';
ALTER TABLE "papers" ADD COLUMN IF NOT EXISTS "duration_minutes" INTEGER;
ALTER TABLE "papers" ADD COLUMN IF NOT EXISTS "total_marks" INTEGER;

ALTER TABLE "papers" DROP CONSTRAINT IF EXISTS "ck_papers_surface";
ALTER TABLE "papers" ADD CONSTRAINT "ck_papers_surface" CHECK ("surface" IN ('simulasi', 'subjektif'));
ALTER TABLE "papers" DROP CONSTRAINT IF EXISTS "ck_papers_duration_minutes";
ALTER TABLE "papers" ADD CONSTRAINT "ck_papers_duration_minutes"
  CHECK ("duration_minutes" IS NULL OR ("duration_minutes" >= 0 AND "duration_minutes" <= 300));
ALTER TABLE "papers" DROP CONSTRAINT IF EXISTS "ck_papers_total_marks";
ALTER TABLE "papers" ADD CONSTRAINT "ck_papers_total_marks" CHECK ("total_marks" IS NULL OR "total_marks" >= 1);

-- Simulasi keeps its minimum; a subjektif paper may be untimed (0).
ALTER TABLE "papers" DROP CONSTRAINT IF EXISTS "ck_papers_duration";
ALTER TABLE "papers" ADD CONSTRAINT "ck_papers_duration"
  CHECK ("printed_duration_min" > 0 OR ("surface" = 'subjektif' AND "printed_duration_min" = 0));

-- A subjektif paper writes Tempoh twice: `printed_duration_min` = `duration_minutes`, or 0 when it is null.
ALTER TABLE "papers" DROP CONSTRAINT IF EXISTS "ck_papers_subjektif_duration";
ALTER TABLE "papers" ADD CONSTRAINT "ck_papers_subjektif_duration"
  CHECK ("surface" <> 'subjektif' OR "printed_duration_min" = COALESCE("duration_minutes", 0));

-- The pupil list and the admin Kertas Subjektif list read by surface and status.
CREATE INDEX IF NOT EXISTS "ix_papers_surface_status" ON "papers" ("surface", "status");
