-- 0008_curriculum (BE-08): education_levels, subjects, subject_levels, chapters, topics, subtopics,
-- curriculum_nodes, curriculum_tp_descriptors (OD-28 / OWN-7), legacy_topics, legacy_subtopics.
-- Written by hand in the style of 0002_identity: identity columns, CHECK constraints (enums are
-- text + check), the functional unique index of curriculum_tp_descriptors. Data model 3.3.

-- CreateTable
CREATE TABLE "education_levels" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "curriculum" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "grade" SMALLINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "education_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT NOT NULL,
    "is_core" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_levels" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "education_level_id" BIGINT NOT NULL,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "subject_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "education_level_id" BIGINT,
    "name" TEXT,
    "name_en" TEXT,
    "chapter_number" INTEGER,
    "description" TEXT,
    "strand" TEXT,
    "dskp_code" TEXT,
    "in_tree" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "chapter_id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT,
    "topic_number" TEXT,
    "description" TEXT,
    "learning_standard" TEXT,
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subtopics" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "topic_id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT,
    "learning_objective" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subtopics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_nodes" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "education_level_id" BIGINT NOT NULL,
    "kind" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "title_printed" TEXT,
    "parent_id" BIGINT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "edition" TEXT NOT NULL,
    "is_elective" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curriculum_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_tp_descriptors" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "node_id" BIGINT,
    "tp" SMALLINT NOT NULL,
    "descriptor" TEXT NOT NULL,
    "scope" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curriculum_tp_descriptors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_topics" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "grade_level" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "legacy_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_subtopics" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "legacy_topic_id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "legacy_subtopics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_education_levels_code" ON "education_levels"("code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_education_levels_legacy" ON "education_levels"("legacy_source", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_subjects_code" ON "subjects"("code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_subjects_legacy" ON "subjects"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_subject_levels_education_level_id" ON "subject_levels"("education_level_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_subject_levels_subject_id_education_level_id" ON "subject_levels"("subject_id", "education_level_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_subject_levels_legacy" ON "subject_levels"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_chapters_subject_id_education_level_id" ON "chapters"("subject_id", "education_level_id");

-- CreateIndex
CREATE INDEX "ix_chapters_education_level_id" ON "chapters"("education_level_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_chapters_legacy" ON "chapters"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_topics_chapter_id" ON "topics"("chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_topics_legacy" ON "topics"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_subtopics_topic_id" ON "subtopics"("topic_id");

-- CreateIndex
CREATE INDEX "ix_curriculum_nodes_parent_id" ON "curriculum_nodes"("parent_id");

-- CreateIndex
CREATE INDEX "ix_curriculum_nodes_subject_id_kind" ON "curriculum_nodes"("subject_id", "kind");

-- CreateIndex
CREATE INDEX "ix_curriculum_nodes_education_level_id" ON "curriculum_nodes"("education_level_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_curriculum_nodes_key" ON "curriculum_nodes"("subject_id", "education_level_id", "edition", "kind", "code");

-- CreateIndex
CREATE INDEX "ix_curriculum_tp_descriptors_subject_id" ON "curriculum_tp_descriptors"("subject_id");

-- CreateIndex
CREATE INDEX "ix_curriculum_tp_descriptors_node_id" ON "curriculum_tp_descriptors"("node_id");

-- CreateIndex
CREATE INDEX "ix_legacy_topics_grade_level_subject_sequence" ON "legacy_topics"("grade_level", "subject", "sequence");

-- CreateIndex
CREATE INDEX "ix_legacy_subtopics_legacy_topic_id" ON "legacy_subtopics"("legacy_topic_id");

-- AddForeignKey
ALTER TABLE "subject_levels" ADD CONSTRAINT "fk_subject_levels_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_levels" ADD CONSTRAINT "fk_subject_levels_education_level_id" FOREIGN KEY ("education_level_id") REFERENCES "education_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "fk_chapters_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "fk_chapters_education_level_id" FOREIGN KEY ("education_level_id") REFERENCES "education_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "fk_topics_chapter_id" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtopics" ADD CONSTRAINT "fk_subtopics_topic_id" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_nodes" ADD CONSTRAINT "fk_curriculum_nodes_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_nodes" ADD CONSTRAINT "fk_curriculum_nodes_education_level_id" FOREIGN KEY ("education_level_id") REFERENCES "education_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_nodes" ADD CONSTRAINT "fk_curriculum_nodes_parent_id" FOREIGN KEY ("parent_id") REFERENCES "curriculum_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_tp_descriptors" ADD CONSTRAINT "fk_curriculum_tp_descriptors_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_tp_descriptors" ADD CONSTRAINT "fk_curriculum_tp_descriptors_node_id" FOREIGN KEY ("node_id") REFERENCES "curriculum_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacy_subtopics" ADD CONSTRAINT "fk_legacy_subtopics_legacy_topic_id" FOREIGN KEY ("legacy_topic_id") REFERENCES "legacy_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row convention checks (plan 14.2) on every migratable table.
ALTER TABLE "education_levels" ADD CONSTRAINT "ck_education_levels_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));
ALTER TABLE "subjects" ADD CONSTRAINT "ck_subjects_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));
ALTER TABLE "subject_levels" ADD CONSTRAINT "ck_subject_levels_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));
ALTER TABLE "chapters" ADD CONSTRAINT "ck_chapters_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));
ALTER TABLE "topics" ADD CONSTRAINT "ck_topics_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));

-- Enums as text + check (English codes; the stage values of the contract CurriculumStage).
ALTER TABLE "education_levels" ADD CONSTRAINT "ck_education_levels_stage"
  CHECK ("stage" IN ('primary', 'lower_secondary', 'upper_secondary'));
ALTER TABLE "education_levels" ADD CONSTRAINT "ck_education_levels_grade" CHECK ("grade" IS NULL OR "grade" BETWEEN 1 AND 11);
-- Codes are stored upper-case (the API upper-cases them), so the plain unique index is case-insensitive.
ALTER TABLE "education_levels" ADD CONSTRAINT "ck_education_levels_code_upper" CHECK ("code" = upper("code"));
ALTER TABLE "subjects" ADD CONSTRAINT "ck_subjects_code_upper" CHECK ("code" = upper("code"));
-- Only the out-of-tree chapters (observed on live) may lack a level and a name.
ALTER TABLE "chapters" ADD CONSTRAINT "ck_chapters_in_tree_complete"
  CHECK ("in_tree" = false OR ("name" IS NOT NULL AND "education_level_id" IS NOT NULL));
ALTER TABLE "curriculum_nodes" ADD CONSTRAINT "ck_curriculum_nodes_kind" CHECK ("kind" IN ('grouping', 'unit', 'sk', 'sp'));
ALTER TABLE "curriculum_tp_descriptors" ADD CONSTRAINT "ck_curriculum_tp_descriptors_tp" CHECK ("tp" BETWEEN 1 AND 6);
ALTER TABLE "curriculum_tp_descriptors" ADD CONSTRAINT "ck_curriculum_tp_descriptors_scope"
  CHECK ("scope" IS NULL OR "scope" IN ('unit', 'sk'));
-- A general level (no node) has no scope; a node level always has one.
ALTER TABLE "curriculum_tp_descriptors" ADD CONSTRAINT "ck_curriculum_tp_descriptors_node_scope"
  CHECK (("node_id" IS NULL) = ("scope" IS NULL));
ALTER TABLE "legacy_topics" ADD CONSTRAINT "ck_legacy_topics_grade_level" CHECK ("grade_level" IN (
  'DARJAH_1', 'DARJAH_2', 'DARJAH_3', 'DARJAH_4', 'DARJAH_5', 'DARJAH_6',
  'TINGKATAN_1', 'TINGKATAN_2', 'TINGKATAN_3', 'TINGKATAN_4', 'TINGKATAN_5'));
ALTER TABLE "legacy_topics" ADD CONSTRAINT "ck_legacy_topics_subject" CHECK ("subject" IN (
  'MATEMATIK', 'BAHASA_MELAYU', 'BAHASA_INGGERIS', 'SAINS',
  'PENDIDIKAN_ISLAM', 'PENDIDIKAN_MORAL', 'SEJARAH', 'GEOGRAFI'));

-- One descriptor per subject, node and tp; the general levels (node null) share the key 0.
CREATE UNIQUE INDEX "uq_curriculum_tp_descriptors_subject_node_tp"
  ON "curriculum_tp_descriptors" ("subject_id", COALESCE("node_id", 0), "tp");
