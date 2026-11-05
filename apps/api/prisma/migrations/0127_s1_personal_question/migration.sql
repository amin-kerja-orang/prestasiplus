-- S6-T16 (requested from S1; DM-42, R1-GUR-44a, API-GUR-24/25): the personal question (Soalan & Rujukan).
-- A teacher's own MCQ is a `question_versions` row with `visibility = 'teacher_private'`, `owner_user_id` = the teacher and an optional
-- `reference_url`. A flag, not a second table, so Misi Harian answers keep the same practice_answers FK to question_versions. Every
-- served or counted bank read adds `visibility = 'bank'` (parts B and C of S6-T16); the mission draw is the only reader of private rows.
-- Additive: no backfill, every existing row becomes 'bank' through the default (adding a NOT NULL column with a constant default is a
-- catalogue-only change on PostgreSQL 11+). Constraints are added NOT VALID then VALIDATEd, as 0128, so the table is not scanned under
-- ACCESS EXCLUSIVE. Beyond the DM-42 check and index, three consistency checks keep the data honest: owner set iff private (a bank row
-- never carries an owner, a private row always has one), and the reference link is http(s) and at most 2048 characters (FR-GUR-44a-8).
-- The owner FK is RESTRICT (not SET NULL) because SET NULL would break the owner-iff-private check; users are soft-deleted in the app.
-- Reversible: no down file (Prisma migrations are forward-only); to revert by hand (delete private rows first, they have no meaning without
-- the flag, and practice_answers may reference them): DELETE FROM "question_versions" WHERE "visibility" = 'teacher_private'; then
-- DROP INDEX "ix_question_versions_owner_private"; ALTER TABLE "question_versions" DROP CONSTRAINT "ck_question_versions_reference_url",
-- DROP CONSTRAINT "ck_question_versions_owner_iff_private", DROP CONSTRAINT "ck_question_versions_visibility",
-- DROP CONSTRAINT "fk_question_versions_owner_user_id", DROP COLUMN "reference_url", DROP COLUMN "owner_user_id", DROP COLUMN "visibility".

ALTER TABLE "question_versions" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'bank';
ALTER TABLE "question_versions" ADD COLUMN "owner_user_id" BIGINT;
ALTER TABLE "question_versions" ADD COLUMN "reference_url" TEXT;

ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_visibility"
  CHECK ("visibility" IN ('bank', 'teacher_private')) NOT VALID;
ALTER TABLE "question_versions" VALIDATE CONSTRAINT "ck_question_versions_visibility";

ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_owner_iff_private"
  CHECK (("visibility" = 'teacher_private') = ("owner_user_id" IS NOT NULL)) NOT VALID;
ALTER TABLE "question_versions" VALIDATE CONSTRAINT "ck_question_versions_owner_iff_private";

ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_reference_url"
  CHECK ("reference_url" IS NULL OR (char_length("reference_url") <= 2048 AND "reference_url" ~ '^https?://')) NOT VALID;
ALTER TABLE "question_versions" VALIDATE CONSTRAINT "ck_question_versions_reference_url";

ALTER TABLE "question_versions" ADD CONSTRAINT "fk_question_versions_owner_user_id"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "question_versions" VALIDATE CONSTRAINT "fk_question_versions_owner_user_id";

CREATE INDEX "ix_question_versions_owner_private" ON "question_versions"("owner_user_id") WHERE "visibility" = 'teacher_private';
