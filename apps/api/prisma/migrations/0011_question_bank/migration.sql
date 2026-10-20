-- 0011_question_bank (BE-09): stimuli, stimulus_groups, stimulus_group_stimuli, stimulus_group_options,
-- questions, question_versions, question_version_sp_nodes, question_version_stimuli, question_parts,
-- part_options, answer_keys, question_tags. Data model 3.4, v2-exam-schema D1 to D12, OD-28.
-- Base generated with `prisma migrate diff`, then identity columns, FKs to other owners, CHECK
-- constraints and the partial and functional indexes written by hand (style of 0008_curriculum).
--
-- Depends on 0002_identity (users), 0005_files (files) and 0008_curriculum only. It does NOT depend on
-- any 0009 table (BE-24 is not on the base yet).
-- Columns without a FK on purpose (G-12): question_versions.source_paper_id (BE-10 source_papers),
-- intake_item_id, source_file_id (BE-36/37), ai_run_id (BE-38). The owning card adds the FK in its own
-- migration.
-- No legacy_* columns: the .cloud question bank is not migrated (D29a, LEAD decision Q-9).

-- CreateTable
CREATE TABLE "stimuli" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT,
    "body_ms" TEXT,
    "body_en" TEXT,
    "caption" TEXT,
    "alt_text" TEXT,
    "source_citation" TEXT,
    "content_hash" TEXT,
    "table_data" JSONB,
    "asset_file_id" BIGINT,
    "reusable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stimuli_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stimulus_groups" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "label" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'section',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stimulus_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stimulus_group_stimuli" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "group_id" BIGINT NOT NULL,
    "stimulus_id" BIGINT NOT NULL,
    "position" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stimulus_group_stimuli_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stimulus_group_options" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "group_id" BIGINT NOT NULL,
    "label" TEXT NOT NULL,
    "body_ms" TEXT,
    "body_en" TEXT,
    "position" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stimulus_group_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "source_type" TEXT,
    "created_by_id" BIGINT,
    "latest_version_no" INTEGER NOT NULL DEFAULT 1,
    "live_version_no" INTEGER,
    "group_id" BIGINT,
    "group_position" SMALLINT,
    "family_id" BIGINT,
    "family_relation" TEXT,
    "parent_question_id" BIGINT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_versions" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "question_id" BIGINT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "archive_reason" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "type" TEXT NOT NULL,
    "stem_ms" TEXT,
    "stem_en" TEXT,
    "number_label" TEXT,
    "language" TEXT NOT NULL DEFAULT 'ms',
    "explanation_ms" TEXT,
    "explanation_en" TEXT,
    "subject_id" BIGINT,
    "education_level_id" BIGINT,
    "unit_node_id" BIGINT,
    "chapter_id" BIGINT,
    "topic_id" BIGINT,
    "form_origin" TEXT NOT NULL DEFAULT 't4',
    "cognitive_level" SMALLINT,
    "difficulty_tp" SMALLINT,
    "textbook_bab" SMALLINT,
    "textbook_tingkatan" SMALLINT,
    "textbook_page" INTEGER,
    "year" SMALLINT,
    "exam_type" TEXT,
    "exam_board" TEXT,
    "set_label" TEXT,
    "paper_code" TEXT,
    "source_kind" TEXT,
    "rights_status" TEXT,
    "contributor_id" BIGINT,
    "source_page" SMALLINT,
    "source_region" JSONB,
    "ai_model" TEXT,
    "import_issues" JSONB,
    "source_paper_id" BIGINT,
    "intake_item_id" BIGINT,
    "source_file_id" BIGINT,
    "ai_run_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_version_sp_nodes" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "question_version_id" BIGINT NOT NULL,
    "node_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_version_sp_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_version_stimuli" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "question_version_id" BIGINT NOT NULL,
    "stimulus_id" BIGINT NOT NULL,
    "position" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_version_stimuli_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_parts" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "question_version_id" BIGINT NOT NULL,
    "parent_part_id" BIGINT,
    "position" SMALLINT NOT NULL,
    "depth" SMALLINT NOT NULL,
    "label" TEXT NOT NULL,
    "prompt_ms" TEXT NOT NULL,
    "prompt_en" TEXT,
    "marks" SMALLINT,
    "mode" TEXT,
    "unit" TEXT,
    "decimals" SMALLINT,
    "sig_figs" SMALLINT,
    "blank_count" SMALLINT,
    "word_min" INTEGER,
    "word_max" INTEGER,
    "drawing_kind" TEXT,
    "table_grid" JSONB,
    "stimulus_id" BIGINT,
    "choice_group" TEXT,
    "reveal" TEXT NOT NULL DEFAULT 'after_submit',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_options" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "part_id" BIGINT NOT NULL,
    "label" TEXT NOT NULL,
    "body_ms" TEXT,
    "body_en" TEXT,
    "image_file_id" BIGINT,
    "position" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "part_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answer_keys" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "part_id" BIGINT NOT NULL,
    "kind" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "answer_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_tags" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "question_id" BIGINT NOT NULL,
    "kind" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_stimuli_content_hash" ON "stimuli"("content_hash");

-- CreateIndex
CREATE INDEX "ix_stimuli_asset_file_id" ON "stimuli"("asset_file_id");

-- CreateIndex
CREATE INDEX "ix_stimulus_group_stimuli_stimulus_id" ON "stimulus_group_stimuli"("stimulus_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_stimulus_group_stimuli_group_id_stimulus_id" ON "stimulus_group_stimuli"("group_id", "stimulus_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_stimulus_group_stimuli_group_id_position" ON "stimulus_group_stimuli"("group_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "uq_stimulus_group_options_group_id_label" ON "stimulus_group_options"("group_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "uq_stimulus_group_options_group_id_position" ON "stimulus_group_options"("group_id", "position");

-- CreateIndex
CREATE INDEX "ix_questions_live_version_no" ON "questions"("live_version_no");

-- CreateIndex
CREATE INDEX "ix_questions_group_id_group_position" ON "questions"("group_id", "group_position");

-- CreateIndex
CREATE INDEX "ix_questions_family_id" ON "questions"("family_id");

-- CreateIndex
CREATE INDEX "ix_questions_created_by_id" ON "questions"("created_by_id");

-- CreateIndex
CREATE INDEX "ix_question_versions_status" ON "question_versions"("status");

-- CreateIndex
CREATE INDEX "ix_question_versions_subject_level_status" ON "question_versions"("subject_id", "education_level_id", "status");

-- CreateIndex
CREATE INDEX "ix_question_versions_unit_node_id" ON "question_versions"("unit_node_id");

-- CreateIndex
CREATE INDEX "ix_question_versions_source_paper_id" ON "question_versions"("source_paper_id");

-- CreateIndex
CREATE INDEX "ix_question_versions_contributor_id" ON "question_versions"("contributor_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_question_versions_question_id_version_no" ON "question_versions"("question_id", "version_no");

-- CreateIndex
CREATE INDEX "ix_question_version_sp_nodes_node_id" ON "question_version_sp_nodes"("node_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_question_version_sp_nodes_question_version_id_node_id" ON "question_version_sp_nodes"("question_version_id", "node_id");

-- CreateIndex
CREATE INDEX "ix_question_version_stimuli_stimulus_id" ON "question_version_stimuli"("stimulus_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_question_version_stimuli_question_version_id_stimulus_id" ON "question_version_stimuli"("question_version_id", "stimulus_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_question_version_stimuli_question_version_id_position" ON "question_version_stimuli"("question_version_id", "position");

-- CreateIndex
CREATE INDEX "ix_question_parts_question_version_id" ON "question_parts"("question_version_id");

-- CreateIndex
CREATE INDEX "ix_question_parts_parent_part_id" ON "question_parts"("parent_part_id");

-- CreateIndex
CREATE INDEX "ix_question_parts_stimulus_id" ON "question_parts"("stimulus_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_part_options_part_id_label" ON "part_options"("part_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "uq_part_options_part_id_position" ON "part_options"("part_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "uq_answer_keys_part_id" ON "answer_keys"("part_id");

-- CreateIndex
CREATE INDEX "ix_question_tags_kind_code" ON "question_tags"("kind", "code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_question_tags_question_id_kind_code" ON "question_tags"("question_id", "kind", "code");

-- AddForeignKey
ALTER TABLE "stimulus_group_stimuli" ADD CONSTRAINT "fk_stimulus_group_stimuli_group_id" FOREIGN KEY ("group_id") REFERENCES "stimulus_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stimulus_group_stimuli" ADD CONSTRAINT "fk_stimulus_group_stimuli_stimulus_id" FOREIGN KEY ("stimulus_id") REFERENCES "stimuli"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stimulus_group_options" ADD CONSTRAINT "fk_stimulus_group_options_group_id" FOREIGN KEY ("group_id") REFERENCES "stimulus_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "fk_questions_group_id" FOREIGN KEY ("group_id") REFERENCES "stimulus_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_versions" ADD CONSTRAINT "fk_question_versions_question_id" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_version_sp_nodes" ADD CONSTRAINT "fk_question_version_sp_nodes_question_version_id" FOREIGN KEY ("question_version_id") REFERENCES "question_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_version_stimuli" ADD CONSTRAINT "fk_question_version_stimuli_question_version_id" FOREIGN KEY ("question_version_id") REFERENCES "question_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_version_stimuli" ADD CONSTRAINT "fk_question_version_stimuli_stimulus_id" FOREIGN KEY ("stimulus_id") REFERENCES "stimuli"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_parts" ADD CONSTRAINT "fk_question_parts_question_version_id" FOREIGN KEY ("question_version_id") REFERENCES "question_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_parts" ADD CONSTRAINT "fk_question_parts_parent_part_id" FOREIGN KEY ("parent_part_id") REFERENCES "question_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_parts" ADD CONSTRAINT "fk_question_parts_stimulus_id" FOREIGN KEY ("stimulus_id") REFERENCES "stimuli"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_options" ADD CONSTRAINT "fk_part_options_part_id" FOREIGN KEY ("part_id") REFERENCES "question_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_keys" ADD CONSTRAINT "fk_answer_keys_part_id" FOREIGN KEY ("part_id") REFERENCES "question_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_tags" ADD CONSTRAINT "fk_question_tags_question_id" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------------------------
-- Hand-written: foreign keys to tables owned by other modules (plain BigInt columns in Prisma, Q-8).
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "stimuli" ADD CONSTRAINT "fk_stimuli_asset_file_id" FOREIGN KEY ("asset_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "part_options" ADD CONSTRAINT "fk_part_options_image_file_id" FOREIGN KEY ("image_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "questions" ADD CONSTRAINT "fk_questions_created_by_id" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "question_versions" ADD CONSTRAINT "fk_question_versions_contributor_id" FOREIGN KEY ("contributor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "question_versions" ADD CONSTRAINT "fk_question_versions_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "question_versions" ADD CONSTRAINT "fk_question_versions_education_level_id" FOREIGN KEY ("education_level_id") REFERENCES "education_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "question_versions" ADD CONSTRAINT "fk_question_versions_unit_node_id" FOREIGN KEY ("unit_node_id") REFERENCES "curriculum_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "question_versions" ADD CONSTRAINT "fk_question_versions_chapter_id" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "question_versions" ADD CONSTRAINT "fk_question_versions_topic_id" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "question_version_sp_nodes" ADD CONSTRAINT "fk_question_version_sp_nodes_node_id" FOREIGN KEY ("node_id") REFERENCES "curriculum_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Self references of questions. family_id is deferrable so a family root can be inserted with its own id.
ALTER TABLE "questions" ADD CONSTRAINT "fk_questions_family_id" FOREIGN KEY ("family_id") REFERENCES "questions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "questions" ADD CONSTRAINT "fk_questions_parent_question_id" FOREIGN KEY ("parent_question_id") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------------------------
-- Hand-written: enums as text + check (English codes, no enum types).
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "stimuli" ADD CONSTRAINT "ck_stimuli_kind"
  CHECK ("kind" IN ('passage', 'image', 'diagram', 'table', 'graph', 'map', 'infographic', 'audio'));
ALTER TABLE "stimulus_groups" ADD CONSTRAINT "ck_stimulus_groups_scope" CHECK ("scope" IN ('section', 'paper'));
-- At most 3 stimuli per group: position 1..3 with unique (group_id, position).
ALTER TABLE "stimulus_group_stimuli" ADD CONSTRAINT "ck_stimulus_group_stimuli_position" CHECK ("position" BETWEEN 1 AND 3);
ALTER TABLE "stimulus_group_options" ADD CONSTRAINT "ck_stimulus_group_options_label" CHECK ("label" ~ '^[A-H]$');
ALTER TABLE "stimulus_group_options" ADD CONSTRAINT "ck_stimulus_group_options_position" CHECK ("position" >= 1);

ALTER TABLE "questions" ADD CONSTRAINT "ck_questions_source_type"
  CHECK ("source_type" IS NULL OR "source_type" IN ('pdf', 'excel', 'manual', 'ai_variant'));
ALTER TABLE "questions" ADD CONSTRAINT "ck_questions_family_relation"
  CHECK ("family_relation" IS NULL OR "family_relation" = 'variant');
ALTER TABLE "questions" ADD CONSTRAINT "ck_questions_group_position"
  CHECK (("group_id" IS NULL) = ("group_position" IS NULL));
ALTER TABLE "questions" ADD CONSTRAINT "ck_questions_latest_version_no" CHECK ("latest_version_no" >= 1);
-- Position inside a group is unique.
CREATE UNIQUE INDEX "uq_questions_group_id_group_position" ON "questions" ("group_id", "group_position") WHERE "group_id" IS NOT NULL;

ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_status"
  CHECK ("status" IN ('draft', 'review', 'approved', 'published', 'archived'));
ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_archive_reason"
  CHECK ("archive_reason" IS NULL OR "archive_reason" IN ('superseded', 'withdrawn', 'source_takedown'));
ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_archive_reason_status"
  CHECK ("archive_reason" IS NULL OR "status" = 'archived');
ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_type"
  CHECK ("type" IN ('mcq', 'match', 'short', 'structured', 'working', 'essay', 'drawing', 'table'));
ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_stem"
  CHECK ("stem_ms" IS NOT NULL OR "stem_en" IS NOT NULL);
ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_language"
  CHECK ("language" IN ('ms', 'en', 'ms_en', 'ar', 'jawi'));
ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_form_origin"
  CHECK ("form_origin" IN ('t1_t3', 't4', 't5'));
ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_cognitive_level"
  CHECK ("cognitive_level" IS NULL OR "cognitive_level" BETWEEN 1 AND 6);
ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_difficulty_tp"
  CHECK ("difficulty_tp" IS NULL OR "difficulty_tp" BETWEEN 1 AND 6);
ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_exam_type"
  CHECK ("exam_type" IS NULL OR "exam_type" IN ('sebenar', 'percubaan', 'modul', 'topikal', 'latihan'));
ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_source_kind"
  CHECK ("source_kind" IS NULL OR "source_kind" IN ('lpm_official', 'state_trial', 'school', 'publisher', 'teacher_own', 'ai_variant'));
ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_rights_status"
  CHECK ("rights_status" IS NULL OR "rights_status" IN ('own', 'school', 'official_lpm', 'third_party', 'unclear'));
-- At most one live (published) version per question.
CREATE UNIQUE INDEX "uq_question_versions_one_published" ON "question_versions" ("question_id") WHERE "status" = 'published';
-- Practice and Bijak pickers: published rows by subject and level.
CREATE INDEX "ix_question_versions_published_subject_level" ON "question_versions" ("subject_id", "education_level_id") WHERE "status" = 'published';

ALTER TABLE "question_version_stimuli" ADD CONSTRAINT "ck_question_version_stimuli_position" CHECK ("position" >= 1);

ALTER TABLE "question_parts" ADD CONSTRAINT "ck_question_parts_depth" CHECK ("depth" BETWEEN 1 AND 3);
ALTER TABLE "question_parts" ADD CONSTRAINT "ck_question_parts_position" CHECK ("position" >= 1);
ALTER TABLE "question_parts" ADD CONSTRAINT "ck_question_parts_marks" CHECK ("marks" IS NULL OR "marks" >= 0);
ALTER TABLE "question_parts" ADD CONSTRAINT "ck_question_parts_mode"
  CHECK ("mode" IS NULL OR "mode" IN ('mcq', 'match_letter', 'short_text', 'numeric', 'working', 'essay', 'drawing', 'table_fill'));
-- A branch part has neither marks nor mode; a leaf part has both.
ALTER TABLE "question_parts" ADD CONSTRAINT "ck_question_parts_leaf_or_branch" CHECK (("mode" IS NULL) = ("marks" IS NULL));
ALTER TABLE "question_parts" ADD CONSTRAINT "ck_question_parts_drawing_kind"
  CHECK ("drawing_kind" IS NULL OR "drawing_kind" IN ('graph', 'diagram', 'sketch'));
ALTER TABLE "question_parts" ADD CONSTRAINT "ck_question_parts_reveal" CHECK ("reveal" IN ('after_submit', 'never'));
-- A root part has depth 1 and no parent; a child has a parent and depth 2 or 3.
ALTER TABLE "question_parts" ADD CONSTRAINT "ck_question_parts_root_depth" CHECK (("parent_part_id" IS NULL) = ("depth" = 1));
-- Sibling order: one position per (version, parent); roots share the key 0.
CREATE UNIQUE INDEX "uq_question_parts_version_parent_position"
  ON "question_parts" ("question_version_id", COALESCE("parent_part_id", 0), "position");

ALTER TABLE "part_options" ADD CONSTRAINT "ck_part_options_label" CHECK ("label" ~ '^[A-H]$');
ALTER TABLE "part_options" ADD CONSTRAINT "ck_part_options_position" CHECK ("position" >= 1);

ALTER TABLE "answer_keys" ADD CONSTRAINT "ck_answer_keys_kind" CHECK ("kind" IN ('option', 'accepted', 'mapping', 'points', 'rubric'));

ALTER TABLE "question_tags" ADD CONSTRAINT "ck_question_tags_kind" CHECK ("kind" IN ('pool', 'pksk_domain', 'pksk_level'));
