-- 0132_s1_stimulus_flag_ref
-- Purpose: DM-53 (card S1-T07). `question_versions.stimulus_flag_ref` records whether the stimulus reference found in the text is numbered
-- ("Rajah 3") or unnumbered ("rajah di atas"); it extends the flag of 0121_s1_servability_flags (45 FR-QA-12). The partial index of 0121 is unchanged.
-- Method: one nullable column, CHECK added NOT VALID then VALIDATE (all rows NULL). No backfill here: the script scripts/uat-ops/flag-stimulus.ts fills it.
-- Reversible by hand: DROP CONSTRAINT, DROP COLUMN.
ALTER TABLE "question_versions" ADD COLUMN "stimulus_flag_ref" TEXT;
ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_stimulus_flag_ref"
  CHECK ("stimulus_flag_ref" IS NULL OR "stimulus_flag_ref" IN ('numbered', 'unnumbered')) NOT VALID;
ALTER TABLE "question_versions" VALIDATE CONSTRAINT "ck_question_versions_stimulus_flag_ref";
