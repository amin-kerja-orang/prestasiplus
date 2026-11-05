-- R1 S3-T06 (DM-83, FR-MUR-13-19, AC-MUR-13-24, R1-MUR-17): the attempt kind is the existing column `exam_attempts.paper_kind`
-- (there is no `kind` column). Widened from `pilihan, jana` (migration 0013) to `pilihan, jana, subjektif, structured`:
--   subjektif   a Kertas Subjektif sitting (`paper_id` set, `mode = 'latihan'`), card S3-T06;
--   structured  a Soalan Berstruktur attempt (`paper_id` null, frozen `composition`), card S5-T11 (adds no migration).
-- Same migration (PO decision 2026-11-05, item 17): `ck_exam_attempts_duration_min` is relaxed to `>= 0` so a sitting of an
-- untimed subjektif paper can be stored. Existing rows satisfy both new checks, so no data change.
--
-- Reversible (only while no row uses the new values or a 0 duration):
--   ALTER TABLE "exam_attempts" DROP CONSTRAINT "ck_exam_attempts_paper_kind";
--   ALTER TABLE "exam_attempts" ADD CONSTRAINT "ck_exam_attempts_paper_kind" CHECK ("paper_kind" IN ('pilihan', 'jana'));
--   ALTER TABLE "exam_attempts" DROP CONSTRAINT "ck_exam_attempts_duration_min";
--   ALTER TABLE "exam_attempts" ADD CONSTRAINT "ck_exam_attempts_duration_min" CHECK ("duration_min" >= 1);

ALTER TABLE "exam_attempts" DROP CONSTRAINT IF EXISTS "ck_exam_attempts_paper_kind";
ALTER TABLE "exam_attempts" ADD CONSTRAINT "ck_exam_attempts_paper_kind"
  CHECK ("paper_kind" IN ('pilihan', 'jana', 'subjektif', 'structured'));

ALTER TABLE "exam_attempts" DROP CONSTRAINT IF EXISTS "ck_exam_attempts_duration_min";
ALTER TABLE "exam_attempts" ADD CONSTRAINT "ck_exam_attempts_duration_min" CHECK ("duration_min" >= 0);
