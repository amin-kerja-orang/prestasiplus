-- 0025_spm_hub (BE-41, owner module M06): spm_subject_configs, spm_tracking_sets, spm_tracking_set_questions,
-- spm_mock_exams, spm_mock_exam_items, duta_profiles (provisional owner, M24 is not built). Data model 3.13.
-- renumber-at-merge, LEAD to confirm: 0025 is proposed (0019 to 0024 are reserved by other cards); the LEAD
-- renumbers this folder when the cards merge.
-- Hand-written in the style of 0015: identity columns (GENERATED ALWAYS), CHECK constraints (enums are text +
-- check), foreign keys to tables of other owners (subjects, users, questions) which the Prisma schema does not
-- declare as relations (see spm.prisma).
--
-- None of these tables is migratable (no .cloud source, v2-data-migration 4.5): no legacy_* columns.
--
-- Reversible: DROP TABLE spm_mock_exam_items, spm_mock_exams, spm_tracking_set_questions, spm_tracking_sets,
-- spm_subject_configs, duta_profiles CASCADE.

-- CreateTable
CREATE TABLE "spm_subject_configs" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "grp" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "databank_order" INTEGER,
    "target_type" TEXT,
    "target_size" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spm_subject_configs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_spm_subject_configs_grp" CHECK ("grp" IN ('teras', 'elektif')),
    CONSTRAINT "ck_spm_subject_configs_target_type" CHECK ("target_type" IS NULL OR "target_type" IN ('spm', 'custom', 'latihan')),
    CONSTRAINT "ck_spm_subject_configs_target" CHECK (("target_type" IS NULL) = ("target_size" IS NULL)),
    CONSTRAINT "ck_spm_subject_configs_target_size" CHECK ("target_size" IS NULL OR "target_size" >= 1)
);

-- CreateTable
CREATE TABLE "spm_tracking_sets" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "year" INTEGER NOT NULL,
    "set_no" INTEGER NOT NULL,
    "dskp_tagged" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spm_tracking_sets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_spm_tracking_sets_set_no" CHECK ("set_no" >= 1),
    CONSTRAINT "ck_spm_tracking_sets_dskp_tagged" CHECK ("dskp_tagged" >= 0)
);

-- CreateTable
CREATE TABLE "spm_tracking_set_questions" (
    "set_id" BIGINT NOT NULL,
    "question_id" BIGINT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "spm_tracking_set_questions_pkey" PRIMARY KEY ("set_id", "position"),
    CONSTRAINT "ck_spm_tracking_set_questions_position" CHECK ("position" >= 1)
);

-- CreateTable
CREATE TABLE "spm_mock_exams" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" BIGINT NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "subject_label" TEXT NOT NULL,
    "paper_number" SMALLINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMPTZ(6),
    "score" INTEGER,
    "max_score" INTEGER NOT NULL,
    "percent" DECIMAL(5,2),
    "grade" TEXT,
    "is_test" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "spm_mock_exams_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_spm_mock_exams_paper_number" CHECK ("paper_number" IN (1, 2)),
    CONSTRAINT "ck_spm_mock_exams_status" CHECK ("status" IN ('in_progress', 'submitted')),
    CONSTRAINT "ck_spm_mock_exams_grade" CHECK ("grade" IS NULL OR "grade" IN ('A+', 'A', 'B+', 'B', 'C', 'D', 'E', 'G')),
    CONSTRAINT "ck_spm_mock_exams_max_score" CHECK ("max_score" >= 0),
    CONSTRAINT "ck_spm_mock_exams_result" CHECK (("status" = 'submitted') = ("submitted_at" IS NOT NULL AND "score" IS NOT NULL AND "percent" IS NOT NULL AND "grade" IS NOT NULL))
);

-- CreateTable
CREATE TABLE "spm_mock_exam_items" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "mock_exam_id" UUID NOT NULL,
    "item_no" INTEGER NOT NULL,
    "question_id" BIGINT,
    "question_text" TEXT NOT NULL,
    "options" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "model_answer" TEXT NOT NULL,
    "student_answer" TEXT,
    "marks" INTEGER,
    "max_marks" INTEGER NOT NULL,
    "feedback" TEXT,
    "topic" TEXT NOT NULL,

    CONSTRAINT "spm_mock_exam_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_spm_mock_exam_items_item_no" CHECK ("item_no" >= 1),
    CONSTRAINT "ck_spm_mock_exam_items_marks" CHECK ("max_marks" >= 1 AND ("marks" IS NULL OR ("marks" >= 0 AND "marks" <= "max_marks")))
);

-- CreateTable
CREATE TABLE "duta_profiles" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "rating" DECIMAL(3,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duta_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_duta_profiles_tier" CHECK ("tier" IN ('bintang', 'inspirasi', 'tetamu')),
    CONSTRAINT "ck_duta_profiles_rating" CHECK ("rating" >= 0 AND "rating" <= 5)
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_spm_subject_configs_subject_id" ON "spm_subject_configs"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_spm_tracking_sets_subject_id_year_set_no" ON "spm_tracking_sets"("subject_id", "year", "set_no");

-- CreateIndex
CREATE INDEX "ix_spm_tracking_sets_subject_id_year" ON "spm_tracking_sets"("subject_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "uq_spm_tracking_set_questions_set_id_question_id" ON "spm_tracking_set_questions"("set_id", "question_id");

-- CreateIndex
CREATE INDEX "ix_spm_tracking_set_questions_question_id" ON "spm_tracking_set_questions"("question_id");

-- CreateIndex
CREATE INDEX "ix_spm_mock_exams_user_id_created_at" ON "spm_mock_exams"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_spm_mock_exam_items_mock_exam_id_item_no" ON "spm_mock_exam_items"("mock_exam_id", "item_no");

-- CreateIndex
CREATE UNIQUE INDEX "uq_duta_profiles_slug" ON "duta_profiles"("slug");

-- AddForeignKey
ALTER TABLE "spm_tracking_set_questions" ADD CONSTRAINT "fk_spm_tracking_set_questions_set_id" FOREIGN KEY ("set_id") REFERENCES "spm_tracking_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spm_mock_exam_items" ADD CONSTRAINT "fk_spm_mock_exam_items_mock_exam_id" FOREIGN KEY ("mock_exam_id") REFERENCES "spm_mock_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys to tables of other owners (not Prisma relations, see spm.prisma). A subject in use cannot be
-- deleted; a deleted learner takes the mock exams with them; a deleted question leaves a gap in the set and keeps
-- the snapshot of a sat mock item.
ALTER TABLE "spm_subject_configs" ADD CONSTRAINT "fk_spm_subject_configs_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "spm_tracking_sets" ADD CONSTRAINT "fk_spm_tracking_sets_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "spm_tracking_set_questions" ADD CONSTRAINT "fk_spm_tracking_set_questions_question_id" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "spm_mock_exams" ADD CONSTRAINT "fk_spm_mock_exams_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "spm_mock_exams" ADD CONSTRAINT "fk_spm_mock_exams_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "spm_mock_exam_items" ADD CONSTRAINT "fk_spm_mock_exam_items_question_id" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
