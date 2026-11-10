-- V2 parity (PO rule: V3 replaces V2, pupils keep every paper): 64 of the 69 V2-published papers have no duration; V2 served
-- them untimed (an elapsed-time clock, no countdown). `ck_papers_duration` (0161) forbids a 0 duration for a Simulasi paper, so such a
-- paper could not load as published. A new flag marks a paper migrated from V2 without a duration; only then may `printed_duration_min`
-- be 0 on a Simulasi paper. A paper authored in V3 stays strict (> 0) and so does any paper whose flag is false.
--   legacy_untimed   true only for a paper the V2 loader (`migrate:papers`) made from a V2 `exam_papers` row with no `duration_minutes`.
-- (A Kertas Subjektif paper may already be untimed: 0161.) The attempt start already gives an untimed paper no deadline (`deadline_at` NULL,
-- `exam_attempts.duration_min` 0 allowed by 0165) and the pupil clock then counts up ("Masa berlalu"), as in V2.
--
-- Reversible (rows with a 0 duration on a Simulasi paper must be given a duration first):
--   ALTER TABLE "papers" DROP CONSTRAINT "ck_papers_duration";
--   ALTER TABLE "papers" ADD CONSTRAINT "ck_papers_duration"
--     CHECK ("printed_duration_min" > 0 OR ("surface" = 'subjektif' AND "printed_duration_min" = 0));
--   ALTER TABLE "papers" DROP COLUMN "legacy_untimed";

ALTER TABLE "papers" ADD COLUMN IF NOT EXISTS "legacy_untimed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "papers" DROP CONSTRAINT IF EXISTS "ck_papers_duration";
ALTER TABLE "papers" ADD CONSTRAINT "ck_papers_duration"
  CHECK (
    "printed_duration_min" > 0
    OR ("surface" = 'subjektif' AND "printed_duration_min" = 0)
    OR ("legacy_untimed" AND "printed_duration_min" = 0)
  );
