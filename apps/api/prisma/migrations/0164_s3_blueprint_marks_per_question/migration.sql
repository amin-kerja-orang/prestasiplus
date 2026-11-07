-- S3-T01 (DM-57, FR-ADM-Q16.8, FR-ADM-Q16.9, FR-QA-25): `Markah setiap soalan` on a Kontrak section and `Bilangan soalan dalam kertas` on the Kontrak.
-- marks_per_question is a json array of integers, one per offered question (`[20, 20, 20]`); it is not the Int `paper_sections.marks_per_question`.
-- Additive and nullable: no backfill (null for existing blueprints), so their structural hashes do not change.
-- rollback: ALTER TABLE blueprint_sections DROP COLUMN marks_per_question; ALTER TABLE blueprints DROP COLUMN question_count;

ALTER TABLE "blueprint_sections" ADD COLUMN "marks_per_question" JSONB NULL;
ALTER TABLE "blueprints" ADD COLUMN "question_count" SMALLINT NULL;
