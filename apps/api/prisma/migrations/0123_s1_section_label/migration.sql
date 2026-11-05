-- S1-T03 (part: upload header and carry), DM-07 plus the D4/D6/D8 additions of the S1-T03 gap check (issue #420, rulings accepted).
--
-- 1. DM-07 / D3: `section_label` (the paper's Bahagian, e.g. "Bahagian A", max 100) on intake_items and on question_versions. Nullable, no backfill.
-- 2. D4: join table intake_item_stimuli(intake_item_id, intake_stimulus_id, position 1..3). An item can name up to 3 stimuli (QE5.8);
--    intake_items.stimulus_id stays the primary one. Schema only here: no code reads or writes the table yet. Rows go with the item (CASCADE)
--    or the stimulus (CASCADE).
-- 3. D6: intake_stimuli.image_file_id, an optional uploaded image for an imageless stimulus (FR-QA-36). FK files ON DELETE SET NULL.
-- 4. D8: intake_files.role ('paper' | 'scheme', default 'paper'); existing rows become 'paper'.
-- All additions are nullable or defaulted, so the migration is additive and safe with running code.
--
-- Down (manual):
--   ALTER TABLE "intake_files" DROP CONSTRAINT "ck_intake_files_role";
--   ALTER TABLE "intake_files" DROP COLUMN "role";
--   ALTER TABLE "intake_stimuli" DROP CONSTRAINT "fk_intake_stimuli_image_file_id";
--   ALTER TABLE "intake_stimuli" DROP COLUMN "image_file_id";
--   DROP TABLE "intake_item_stimuli";
--   ALTER TABLE "question_versions" DROP CONSTRAINT "ck_question_versions_section_label";
--   ALTER TABLE "question_versions" DROP COLUMN "section_label";
--   ALTER TABLE "intake_items" DROP CONSTRAINT "ck_intake_items_section_label";
--   ALTER TABLE "intake_items" DROP COLUMN "section_label";

ALTER TABLE "intake_items" ADD COLUMN "section_label" TEXT;
ALTER TABLE "intake_items" ADD CONSTRAINT "ck_intake_items_section_label" CHECK ("section_label" IS NULL OR char_length("section_label") BETWEEN 1 AND 100);

ALTER TABLE "question_versions" ADD COLUMN "section_label" TEXT;
ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_section_label" CHECK ("section_label" IS NULL OR char_length("section_label") BETWEEN 1 AND 100);

CREATE TABLE "intake_item_stimuli" (
    "intake_item_id" BIGINT NOT NULL,
    "intake_stimulus_id" BIGINT NOT NULL,
    "position" SMALLINT NOT NULL,
    CONSTRAINT "intake_item_stimuli_pkey" PRIMARY KEY ("intake_item_id", "intake_stimulus_id"),
    CONSTRAINT "ck_intake_item_stimuli_position" CHECK ("position" BETWEEN 1 AND 3),
    CONSTRAINT "fk_intake_item_stimuli_intake_item_id" FOREIGN KEY ("intake_item_id") REFERENCES "intake_items"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_intake_item_stimuli_intake_stimulus_id" FOREIGN KEY ("intake_stimulus_id") REFERENCES "intake_stimuli"("id") ON DELETE CASCADE
);
CREATE INDEX "ix_intake_item_stimuli_intake_stimulus_id" ON "intake_item_stimuli"("intake_stimulus_id");

ALTER TABLE "intake_stimuli" ADD COLUMN "image_file_id" BIGINT;
ALTER TABLE "intake_stimuli" ADD CONSTRAINT "fk_intake_stimuli_image_file_id" FOREIGN KEY ("image_file_id") REFERENCES "files"("id") ON DELETE SET NULL;

ALTER TABLE "intake_files" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'paper';
ALTER TABLE "intake_files" ADD CONSTRAINT "ck_intake_files_role" CHECK ("role" IN ('paper', 'scheme'));
