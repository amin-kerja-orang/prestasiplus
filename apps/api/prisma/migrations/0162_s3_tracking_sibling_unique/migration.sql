-- DM-24 (S3-T05, ADR-0032 as amended): a question sits in one Tracking A set per subject and year (INV-26).
-- The columns copy the parent set, whose subject and year never change. They stay nullable (D-6b): every writer sets them.
-- Before this migration runs, apps/api/scripts/uat-ops/tracking-sibling-duplicates.sql lists the sibling duplicates; an admin
-- removes each from the later sibling (D-6a). A duplicate left behind stops this migration at CREATE UNIQUE INDEX.
ALTER TABLE "spm_tracking_set_questions" ADD COLUMN "subject_id" BIGINT;
ALTER TABLE "spm_tracking_set_questions" ADD COLUMN "year" INTEGER;

UPDATE "spm_tracking_set_questions" q
   SET "subject_id" = s."subject_id", "year" = s."year"
  FROM "spm_tracking_sets" s
 WHERE s."id" = q."set_id";

CREATE UNIQUE INDEX "uq_spm_tracking_set_questions_subject_id_year_question_id"
  ON "spm_tracking_set_questions" ("subject_id", "year", "question_id");
