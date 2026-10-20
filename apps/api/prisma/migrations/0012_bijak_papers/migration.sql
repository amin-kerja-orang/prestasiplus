-- 0012_bijak_papers (BE-15, M28 Bijak SPM): blueprints, blueprint_sections, papers, paper_sections,
-- paper_placements. Written by hand in the style of 0008_curriculum: identity columns (GENERATED
-- ALWAYS), CHECK constraints (enums are text + check, English codes), the partial unique and
-- partial indexes Prisma cannot express. Data model 3.8, exam schema D5 and D7.
--
-- BE-39 (paper builder) makes no schema change: the status, version, provenance and printed-duration
-- columns it needs are created here. BE-16 appends the attempt tables in 0013.
--
-- Foreign keys to other cards: subjects (BE-08, 0008) and users (0002) exist on the base and are
-- enforced. paper_placements.question_id points at questions.id (BE-09, migration 0011), which is
-- not on the base this was written against: the FK is added by the integrator after BE-09 merges.
-- These tables receive no .cloud rows (archived, not migrated), so no legacy_* columns.

-- CreateTable
CREATE TABLE "blueprints" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "kertas" SMALLINT NOT NULL,
    "code" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "source" TEXT NOT NULL DEFAULT 'spec',
    "provenance" TEXT,
    "confidence" TEXT,
    "duration_min" INTEGER NOT NULL,
    "total_marks" INTEGER,
    "language_mode" TEXT,
    "auto_markable" BOOLEAN,
    "instructions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "reference_sheets" JSONB NOT NULL DEFAULT '[]',
    "cognitive_mix" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blueprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blueprint_sections" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "blueprint_id" BIGINT NOT NULL,
    "position" SMALLINT NOT NULL,
    "label" TEXT NOT NULL,
    "instruction" TEXT,
    "rule_type" TEXT NOT NULL DEFAULT 'all',
    "rule_n" SMALLINT,
    "question_count" INTEGER NOT NULL,
    "mark_budget" INTEGER,
    "compulsory" BOOLEAN NOT NULL DEFAULT false,
    "pool" TEXT,
    "allowed_modes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "topic_weights" JSONB,

    CONSTRAINT "blueprint_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "papers" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "kertas" SMALLINT NOT NULL,
    "year" SMALLINT,
    "paper_code" TEXT,
    "level_scope" TEXT,
    "printed_duration_min" INTEGER NOT NULL,
    "language_mode" TEXT,
    "instructions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "reference_sheets" JSONB NOT NULL DEFAULT '[]',
    "blueprint_id" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "generated_for_user_id" BIGINT,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(6),
    "created_by_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "papers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_sections" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "paper_id" BIGINT NOT NULL,
    "position" SMALLINT NOT NULL,
    "label" TEXT NOT NULL,
    "title" TEXT,
    "instruction" TEXT,
    "rule_type" TEXT NOT NULL DEFAULT 'all',
    "rule_n" SMALLINT,
    "question_count" INTEGER NOT NULL,
    "mark_budget" INTEGER NOT NULL,
    "marks_per_question" INTEGER,
    "allowed_modes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "compulsory" BOOLEAN NOT NULL DEFAULT false,
    "answer_medium" TEXT,
    "stimulus_policy" TEXT,

    CONSTRAINT "paper_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_placements" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "paper_section_id" BIGINT NOT NULL,
    "question_id" BIGINT NOT NULL,
    "pinned_version_no" INTEGER NOT NULL DEFAULT 1,
    "position" SMALLINT NOT NULL,
    "number_label" TEXT,
    "marks_override" SMALLINT,

    CONSTRAINT "paper_placements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_blueprints_code_version" ON "blueprints"("code", "version");

-- CreateIndex
CREATE INDEX "ix_blueprints_subject_id_kertas" ON "blueprints"("subject_id", "kertas");

-- CreateIndex
CREATE UNIQUE INDEX "uq_blueprint_sections_blueprint_id_position" ON "blueprint_sections"("blueprint_id", "position");

-- CreateIndex
CREATE INDEX "ix_papers_status" ON "papers"("status");

-- CreateIndex
CREATE INDEX "ix_papers_subject_id_kertas_status" ON "papers"("subject_id", "kertas", "status");

-- CreateIndex
CREATE INDEX "ix_papers_blueprint_id" ON "papers"("blueprint_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_paper_sections_paper_id_position" ON "paper_sections"("paper_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "uq_paper_placements_paper_section_id_position" ON "paper_placements"("paper_section_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "uq_paper_placements_paper_section_id_question_id" ON "paper_placements"("paper_section_id", "question_id");

-- CreateIndex
CREATE INDEX "ix_paper_placements_question_id" ON "paper_placements"("question_id");

-- AddForeignKey
ALTER TABLE "blueprints" ADD CONSTRAINT "fk_blueprints_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blueprint_sections" ADD CONSTRAINT "fk_blueprint_sections_blueprint_id" FOREIGN KEY ("blueprint_id") REFERENCES "blueprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "papers" ADD CONSTRAINT "fk_papers_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "papers" ADD CONSTRAINT "fk_papers_blueprint_id" FOREIGN KEY ("blueprint_id") REFERENCES "blueprints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "papers" ADD CONSTRAINT "fk_papers_generated_for_user_id" FOREIGN KEY ("generated_for_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "papers" ADD CONSTRAINT "fk_papers_created_by_id" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_sections" ADD CONSTRAINT "fk_paper_sections_paper_id" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_placements" ADD CONSTRAINT "fk_paper_placements_paper_section_id" FOREIGN KEY ("paper_section_id") REFERENCES "paper_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enums as text + check (English codes; BM labels stay in the UI).
ALTER TABLE "blueprints" ADD CONSTRAINT "ck_blueprints_status" CHECK ("status" IN ('draft', 'active', 'retired'));
ALTER TABLE "blueprints" ADD CONSTRAINT "ck_blueprints_source" CHECK ("source" IN ('verified', 'spec', 'draft'));
ALTER TABLE "blueprints" ADD CONSTRAINT "ck_blueprints_provenance"
  CHECK ("provenance" IS NULL OR "provenance" IN ('data', 'paper', 'dskp', 'inferred'));
ALTER TABLE "blueprints" ADD CONSTRAINT "ck_blueprints_confidence"
  CHECK ("confidence" IS NULL OR "confidence" IN ('high', 'medium', 'low'));
ALTER TABLE "blueprints" ADD CONSTRAINT "ck_blueprints_kertas" CHECK ("kertas" >= 1);
ALTER TABLE "blueprints" ADD CONSTRAINT "ck_blueprints_version" CHECK ("version" >= 1);
ALTER TABLE "blueprints" ADD CONSTRAINT "ck_blueprints_duration" CHECK ("duration_min" > 0);
ALTER TABLE "blueprint_sections" ADD CONSTRAINT "ck_blueprint_sections_rule_type" CHECK ("rule_type" IN ('all', 'choose'));
-- "choose n" needs n (at least 1); "all" has none.
ALTER TABLE "blueprint_sections" ADD CONSTRAINT "ck_blueprint_sections_rule_n"
  CHECK (("rule_type" = 'choose' AND "rule_n" IS NOT NULL AND "rule_n" >= 1) OR ("rule_type" = 'all' AND "rule_n" IS NULL));
ALTER TABLE "blueprint_sections" ADD CONSTRAINT "ck_blueprint_sections_question_count" CHECK ("question_count" >= 1);
ALTER TABLE "blueprint_sections" ADD CONSTRAINT "ck_blueprint_sections_mark_budget"
  CHECK ("mark_budget" IS NULL OR "mark_budget" >= 0);

ALTER TABLE "papers" ADD CONSTRAINT "ck_papers_kind" CHECK ("kind" IN ('pilihan', 'jana'));
ALTER TABLE "papers" ADD CONSTRAINT "ck_papers_status" CHECK ("status" IN ('draft', 'ready', 'published', 'withdrawn'));
ALTER TABLE "papers" ADD CONSTRAINT "ck_papers_level_scope"
  CHECK ("level_scope" IS NULL OR "level_scope" IN ('t4', 't5', 't4_t5'));
ALTER TABLE "papers" ADD CONSTRAINT "ck_papers_kertas" CHECK ("kertas" >= 1);
ALTER TABLE "papers" ADD CONSTRAINT "ck_papers_version" CHECK ("version" >= 1);
ALTER TABLE "papers" ADD CONSTRAINT "ck_papers_duration" CHECK ("printed_duration_min" > 0);
-- A generated paper belongs to one user; a curated paper to none (private to its owner, AC 5).
ALTER TABLE "papers" ADD CONSTRAINT "ck_papers_jana_owner"
  CHECK (("kind" = 'jana') = ("generated_for_user_id" IS NOT NULL));
ALTER TABLE "paper_sections" ADD CONSTRAINT "ck_paper_sections_rule_type" CHECK ("rule_type" IN ('all', 'choose'));
ALTER TABLE "paper_sections" ADD CONSTRAINT "ck_paper_sections_rule_n"
  CHECK (("rule_type" = 'choose' AND "rule_n" IS NOT NULL AND "rule_n" >= 1) OR ("rule_type" = 'all' AND "rule_n" IS NULL));
ALTER TABLE "paper_sections" ADD CONSTRAINT "ck_paper_sections_counts" CHECK ("question_count" >= 0 AND "mark_budget" >= 0);
ALTER TABLE "paper_sections" ADD CONSTRAINT "ck_paper_sections_answer_medium"
  CHECK ("answer_medium" IS NULL OR "answer_medium" IN ('on_paper', 'separate_book', 'omr'));
ALTER TABLE "paper_sections" ADD CONSTRAINT "ck_paper_sections_stimulus_policy"
  CHECK ("stimulus_policy" IS NULL OR "stimulus_policy" IN ('none', 'group', 'per_part'));
ALTER TABLE "paper_placements" ADD CONSTRAINT "ck_paper_placements_pinned_version" CHECK ("pinned_version_no" >= 1);
ALTER TABLE "paper_placements" ADD CONSTRAINT "ck_paper_placements_marks_override"
  CHECK ("marks_override" IS NULL OR "marks_override" >= 0);

-- One active version per subject and kertas: the Kontrak Jana Kertas reads (a new version is a new row).
CREATE UNIQUE INDEX "uq_blueprints_active_subject_id_kertas" ON "blueprints" ("subject_id", "kertas") WHERE "status" = 'active';
-- Generated papers are looked up by owner; curated papers have no owner.
CREATE INDEX "ix_papers_generated_for_user_id" ON "papers" ("generated_for_user_id") WHERE "generated_for_user_id" IS NOT NULL;
