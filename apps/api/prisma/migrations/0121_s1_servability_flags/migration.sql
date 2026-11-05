-- 0121_s1_servability_flags
-- Purpose: DM-05 (card S1-T07). The stored stimulus flag of a question version: `stimulus_missing` (the text names a figure, passage or
-- table and no group, stimulus or image is attached), `figure_only` (a bare figure imported as a question) and `stem_duplicated`
-- (the stem equals the prompt of its only leaf). `stimulus_missing` and `figure_only` exclude the question from every pupil surface
-- (NOT_FLAGGED_SQL, learner-visibility.ts); `stem_duplicated` is shown once and never excluded. "Bukan masalah" sets flag_dismissed_at/by.
-- Stored, not computed: draws and counts run over the whole bank (ADR-0028 `question_version_facts` was never built).
-- Method: nullable columns without default (metadata only), CHECK added NOT VALID then VALIDATE (every row is NULL, so it passes), FK to users
-- set null, and a PARTIAL index that stays empty until the backfill script (scripts/uat-ops/flag-stimulus.ts) runs. No data change.
-- Reversible by hand: DROP INDEX, DROP CONSTRAINT x2, DROP COLUMN x4 (Prisma migrations are forward-only; no down file).
ALTER TABLE "question_versions"
  ADD COLUMN "stimulus_flag" TEXT,
  ADD COLUMN "stimulus_flag_at" TIMESTAMPTZ(6),
  ADD COLUMN "flag_dismissed_at" TIMESTAMPTZ(6),
  ADD COLUMN "flag_dismissed_by" BIGINT;

ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_stimulus_flag"
  CHECK ("stimulus_flag" IS NULL OR "stimulus_flag" IN ('stimulus_missing', 'figure_only', 'stem_duplicated')) NOT VALID;
ALTER TABLE "question_versions" VALIDATE CONSTRAINT "ck_question_versions_stimulus_flag";

ALTER TABLE "question_versions" ADD CONSTRAINT "fk_question_versions_flag_dismissed_by"
  FOREIGN KEY ("flag_dismissed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The work-list and the hub "Perhatian" count (DM-05): open (not dismissed) flags per subject and level.
CREATE INDEX "ix_question_versions_open_flag" ON "question_versions" ("subject_id", "education_level_id")
  WHERE "stimulus_flag" IS NOT NULL AND "flag_dismissed_at" IS NULL;
