-- S1-T01 part 3, DM-51 + DM-52: the scope of a stimulus group, the draft copy of a published group, and the option-bank row fields.
--
-- DM-51 (`stimulus_groups`): `subject_id`, `education_level_id` and `kertas` (1..4) are the Subjek, Tingkatan and optional Kertas of the group
-- itself, so an empty group already has them. NULL means "no restriction" (the level check is skipped, the subject check between members stays).
-- `draft_of_group_id` (self FK, ON DELETE SET NULL) with a partial unique index (one open draft copy per group), `draft_members` (jsonb, ordered
-- question ids staged in the copy), `draft_created_by` (FK users, SET NULL) and `draft_created_at` hold the draft copy.
--
-- Backfill (one UPDATE over groups that have members; a group with 0 members keeps NULL): each scope column takes the COMMON value of the members'
-- latest versions and is NULL when the members differ or any member has no value (mixed T4/T5 groups, D115). `kertas` is read from the paper code
-- of the latest version like `kertasOfPaperCode` (the trailing digit after the last slash, 1 to 3).
--
-- DM-52 (`stimulus_group_options`): `body` text null, `image_file_id` (FK files, SET NULL) and `is_distractor` boolean not null default false.
-- (`stimuli.source_citation` already exists since 0011; it is not added here.)
--
-- Lock: ADD COLUMN with no default (and one constant default on a small table) is a metadata change; the backfill updates only grouped rows.
-- Reversible: the down step drops the index, the constraints and the ten added columns (data in the new columns is lost, nothing else is):
--   DROP INDEX uq_stimulus_groups_draft_of_group_id; ALTER TABLE stimulus_groups DROP COLUMN subject_id, DROP COLUMN education_level_id, DROP COLUMN kertas,
--   DROP COLUMN draft_of_group_id, DROP COLUMN draft_members, DROP COLUMN draft_created_by, DROP COLUMN draft_created_at;
--   ALTER TABLE stimulus_group_options DROP COLUMN body, DROP COLUMN image_file_id, DROP COLUMN is_distractor;
-- (dropping a column drops its constraints with it).

ALTER TABLE "stimulus_groups"
  ADD COLUMN "subject_id" BIGINT,
  ADD COLUMN "education_level_id" BIGINT,
  ADD COLUMN "kertas" SMALLINT,
  ADD COLUMN "draft_of_group_id" BIGINT,
  ADD COLUMN "draft_members" JSONB,
  ADD COLUMN "draft_created_by" BIGINT,
  ADD COLUMN "draft_created_at" TIMESTAMPTZ(6);

ALTER TABLE "stimulus_groups" ADD CONSTRAINT "fk_stimulus_groups_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stimulus_groups" ADD CONSTRAINT "fk_stimulus_groups_level_id" FOREIGN KEY ("education_level_id") REFERENCES "education_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stimulus_groups" ADD CONSTRAINT "fk_stimulus_groups_draft_of" FOREIGN KEY ("draft_of_group_id") REFERENCES "stimulus_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stimulus_groups" ADD CONSTRAINT "fk_stimulus_groups_draft_created_by" FOREIGN KEY ("draft_created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stimulus_groups" ADD CONSTRAINT "ck_stimulus_groups_kertas" CHECK ("kertas" IS NULL OR "kertas" BETWEEN 1 AND 4);
ALTER TABLE "stimulus_groups" ADD CONSTRAINT "ck_stimulus_groups_draft_members" CHECK ("draft_members" IS NULL OR jsonb_typeof("draft_members") = 'array');
CREATE UNIQUE INDEX "uq_stimulus_groups_draft_of_group_id" ON "stimulus_groups"("draft_of_group_id") WHERE "draft_of_group_id" IS NOT NULL;

-- Backfill: the common value of the members' latest versions, else NULL.
UPDATE "stimulus_groups" g
   SET "subject_id" = m.subject_id,
       "education_level_id" = m.level_id,
       "kertas" = m.kertas
  FROM (
    SELECT t.group_id,
           CASE WHEN count(*) = count(t.subject_id) AND count(DISTINCT t.subject_id) = 1 THEN min(t.subject_id) END AS subject_id,
           CASE WHEN count(*) = count(t.level_id) AND count(DISTINCT t.level_id) = 1 THEN min(t.level_id) END AS level_id,
           CASE WHEN count(*) = count(t.kertas) AND count(DISTINCT t.kertas) = 1 THEN min(t.kertas) END AS kertas
      FROM (
        SELECT q.group_id,
               lv.subject_id,
               lv.education_level_id AS level_id,
               CASE WHEN substring(lv.paper_code FROM '/([0-9])\s*$') IN ('1', '2', '3') THEN substring(lv.paper_code FROM '/([0-9])\s*$')::smallint END AS kertas
          FROM "questions" q
          JOIN "question_versions" lv ON lv.question_id = q.id AND lv.version_no = q.latest_version_no
         WHERE q.group_id IS NOT NULL
      ) t
     GROUP BY t.group_id
  ) m
 WHERE g.id = m.group_id;

ALTER TABLE "stimulus_group_options"
  ADD COLUMN "body" TEXT,
  ADD COLUMN "image_file_id" BIGINT,
  ADD COLUMN "is_distractor" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "stimulus_group_options" ADD CONSTRAINT "fk_stimulus_group_options_image_file_id" FOREIGN KEY ("image_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
