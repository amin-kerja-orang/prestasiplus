-- 0021_missions_question_sets (BE-18): missions, mission_items, remedial_tests, remedial_test_items, question_sets,
-- question_set_items, dskp_bidang, dskp_sk, dskp_sp (M10 part B). Number proposed by BE-18: renumber at merge, LEAD
-- to confirm. Hand-written in the style of `prisma migrate diff` output: identity columns (GENERATED ALWAYS), CHECK
-- constraints (enums are text + check) and the foreign keys to tables of other owners (users, classrooms, subjects,
-- chapters, education_levels, questions), which classes.prisma does not declare as relations. Data model 3.9.
-- Every referenced table exists before this migration: users (0002), subjects/chapters/education_levels (0008),
-- questions (0011), classrooms (0015).

-- CreateTable
CREATE TABLE "missions" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "teacher_id" BIGINT NOT NULL,
    "classroom_id" BIGINT,
    "title" TEXT NOT NULL,
    "mission_type" TEXT NOT NULL,
    "mission_date" DATE NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "chapter_id" BIGINT,
    "question_count" SMALLINT NOT NULL,
    "coins_per_correct" SMALLINT NOT NULL DEFAULT 3,
    "resource_title" TEXT,
    "resource_url" TEXT,
    "resource_note" TEXT,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_items" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "mission_id" BIGINT NOT NULL,
    "student_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mission_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remedial_tests" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "teacher_id" BIGINT NOT NULL,
    "student_id" BIGINT NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "total_questions" SMALLINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "before_accuracy" DECIMAL(5,2) NOT NULL,
    "after_accuracy" DECIMAL(5,2),
    "completed_at" TIMESTAMPTZ(6),
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remedial_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remedial_test_items" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "remedial_test_id" BIGINT NOT NULL,
    "position" SMALLINT NOT NULL,
    "question_id" BIGINT NOT NULL,
    "question_version_no" INTEGER NOT NULL,

    CONSTRAINT "remedial_test_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_sets" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "teacher_id" BIGINT NOT NULL,
    "classroom_id" BIGINT NOT NULL,
    "subject_id" BIGINT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "group_tag" TEXT,
    "time_limit_minutes" SMALLINT,
    "max_attempts" SMALLINT NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduled_at" TIMESTAMPTZ(6),
    "needs_rebuild" BOOLEAN NOT NULL DEFAULT false,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "question_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_set_items" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "question_set_id" BIGINT NOT NULL,
    "position" SMALLINT NOT NULL,
    "question_id" BIGINT NOT NULL,
    "question_version_no" INTEGER NOT NULL,

    CONSTRAINT "question_set_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dskp_bidang" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "education_level_id" BIGINT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "created_by_id" BIGINT,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dskp_bidang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dskp_sk" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "bidang_id" BIGINT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_by_id" BIGINT,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dskp_sk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dskp_sp" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "sk_id" BIGINT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_by_id" BIGINT,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dskp_sp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_missions_legacy" ON "missions"("legacy_source", "legacy_id");
CREATE INDEX "ix_missions_teacher_id_created_at" ON "missions"("teacher_id", "created_at");
CREATE INDEX "ix_missions_mission_date" ON "missions"("mission_date");
CREATE UNIQUE INDEX "uq_mission_items_mission_id_student_id" ON "mission_items"("mission_id", "student_id");
CREATE INDEX "ix_mission_items_student_id" ON "mission_items"("student_id");
CREATE INDEX "ix_remedial_tests_teacher_id_created_at" ON "remedial_tests"("teacher_id", "created_at");
CREATE INDEX "ix_remedial_tests_student_id_status" ON "remedial_tests"("student_id", "status");
-- One open (active) remedial test per teacher, pupil and subject (BR-M10-12): the advisory lock in the service is the first guard, this index the last.
-- Prisma cannot express a partial index, so it is documented on the RemedialTest model instead.
CREATE UNIQUE INDEX "uq_remedial_tests_open" ON "remedial_tests"("teacher_id", "student_id", "subject_id") WHERE "status" = 'active';
CREATE UNIQUE INDEX "uq_remedial_test_items_remedial_test_id_position" ON "remedial_test_items"("remedial_test_id", "position");
CREATE UNIQUE INDEX "uq_remedial_test_items_remedial_test_id_question_id" ON "remedial_test_items"("remedial_test_id", "question_id");
CREATE INDEX "ix_remedial_test_items_question_id" ON "remedial_test_items"("question_id");
CREATE UNIQUE INDEX "uq_question_sets_legacy" ON "question_sets"("legacy_source", "legacy_id");
CREATE INDEX "ix_question_sets_classroom_id_status" ON "question_sets"("classroom_id", "status");
CREATE INDEX "ix_question_sets_teacher_id_created_at" ON "question_sets"("teacher_id", "created_at");
CREATE UNIQUE INDEX "uq_question_set_items_question_set_id_position" ON "question_set_items"("question_set_id", "position");
CREATE UNIQUE INDEX "uq_question_set_items_question_set_id_question_id" ON "question_set_items"("question_set_id", "question_id");
CREATE INDEX "ix_question_set_items_question_id" ON "question_set_items"("question_id");
CREATE INDEX "ix_dskp_bidang_subject_id_education_level_id" ON "dskp_bidang"("subject_id", "education_level_id");
CREATE INDEX "ix_dskp_sk_bidang_id" ON "dskp_sk"("bidang_id");
CREATE INDEX "ix_dskp_sp_sk_id" ON "dskp_sp"("sk_id");

-- AddForeignKey (relations inside this file)
ALTER TABLE "mission_items" ADD CONSTRAINT "fk_mission_items_mission_id" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "remedial_test_items" ADD CONSTRAINT "fk_remedial_test_items_remedial_test_id" FOREIGN KEY ("remedial_test_id") REFERENCES "remedial_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_set_items" ADD CONSTRAINT "fk_question_set_items_question_set_id" FOREIGN KEY ("question_set_id") REFERENCES "question_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dskp_sk" ADD CONSTRAINT "fk_dskp_sk_bidang_id" FOREIGN KEY ("bidang_id") REFERENCES "dskp_bidang"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dskp_sp" ADD CONSTRAINT "fk_dskp_sp_sk_id" FOREIGN KEY ("sk_id") REFERENCES "dskp_sk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys to tables of other owners (not Prisma relations, see classes.prisma).
-- A teacher's assigned work goes with the teacher; a student's remedial tests and recipient rows go with the student.
-- A subject, level, chapter or question in use cannot be deleted (RESTRICT); a deleted class nulls the mission link
-- but removes its question sets (a set belongs to its class); a deleted author leaves the DSKP pick in place.
ALTER TABLE "missions" ADD CONSTRAINT "fk_missions_teacher_id" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "missions" ADD CONSTRAINT "fk_missions_classroom_id" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "missions" ADD CONSTRAINT "fk_missions_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "missions" ADD CONSTRAINT "fk_missions_chapter_id" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mission_items" ADD CONSTRAINT "fk_mission_items_student_id" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "remedial_tests" ADD CONSTRAINT "fk_remedial_tests_teacher_id" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "remedial_tests" ADD CONSTRAINT "fk_remedial_tests_student_id" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "remedial_tests" ADD CONSTRAINT "fk_remedial_tests_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "remedial_test_items" ADD CONSTRAINT "fk_remedial_test_items_question_id" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "question_sets" ADD CONSTRAINT "fk_question_sets_teacher_id" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_sets" ADD CONSTRAINT "fk_question_sets_classroom_id" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_sets" ADD CONSTRAINT "fk_question_sets_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "question_set_items" ADD CONSTRAINT "fk_question_set_items_question_id" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dskp_bidang" ADD CONSTRAINT "fk_dskp_bidang_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dskp_bidang" ADD CONSTRAINT "fk_dskp_bidang_education_level_id" FOREIGN KEY ("education_level_id") REFERENCES "education_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dskp_bidang" ADD CONSTRAINT "fk_dskp_bidang_created_by_id" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dskp_sk" ADD CONSTRAINT "fk_dskp_sk_created_by_id" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dskp_sp" ADD CONSTRAINT "fk_dskp_sp_created_by_id" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row convention checks (plan 14.2): legacy_source, on every table that carries the pair. NULL passes a CHECK.
ALTER TABLE "missions" ADD CONSTRAINT "ck_missions_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));
ALTER TABLE "question_sets" ADD CONSTRAINT "ck_question_sets_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));

-- Enums as text + check (English codes of @pp/contract: MissionType, RemedialStatus; question set status of the mock).
ALTER TABLE "missions" ADD CONSTRAINT "ck_missions_mission_type" CHECK ("mission_type" IN ('latih_tubi', 'tracking_a', 'youtube'));
ALTER TABLE "remedial_tests" ADD CONSTRAINT "ck_remedial_tests_status" CHECK ("status" IN ('active', 'completed', 'cancelled'));
ALTER TABLE "question_sets" ADD CONSTRAINT "ck_question_sets_status" CHECK ("status" IN ('draft', 'scheduled', 'published'));

-- Value rules.
ALTER TABLE "missions" ADD CONSTRAINT "ck_missions_title" CHECK (char_length(btrim("title")) BETWEEN 1 AND 255);
ALTER TABLE "missions" ADD CONSTRAINT "ck_missions_question_count" CHECK ("question_count" BETWEEN 1 AND 100);
ALTER TABLE "missions" ADD CONSTRAINT "ck_missions_coins_per_correct" CHECK ("coins_per_correct" >= 0);
ALTER TABLE "remedial_tests" ADD CONSTRAINT "ck_remedial_tests_total_questions" CHECK ("total_questions" >= 0);
ALTER TABLE "remedial_tests" ADD CONSTRAINT "ck_remedial_tests_completed_at" CHECK (("status" = 'completed') = ("completed_at" IS NOT NULL));
ALTER TABLE "remedial_test_items" ADD CONSTRAINT "ck_remedial_test_items_position" CHECK ("position" >= 0);
ALTER TABLE "remedial_test_items" ADD CONSTRAINT "ck_remedial_test_items_question_version_no" CHECK ("question_version_no" >= 1);
ALTER TABLE "question_sets" ADD CONSTRAINT "ck_question_sets_title" CHECK (char_length(btrim("title")) BETWEEN 1 AND 255);
ALTER TABLE "question_sets" ADD CONSTRAINT "ck_question_sets_time_limit_minutes" CHECK ("time_limit_minutes" IS NULL OR "time_limit_minutes" >= 1);
ALTER TABLE "question_sets" ADD CONSTRAINT "ck_question_sets_max_attempts" CHECK ("max_attempts" >= 0);
ALTER TABLE "question_sets" ADD CONSTRAINT "ck_question_sets_scheduled_at" CHECK ("status" <> 'scheduled' OR "scheduled_at" IS NOT NULL);
ALTER TABLE "question_set_items" ADD CONSTRAINT "ck_question_set_items_position" CHECK ("position" >= 0);
ALTER TABLE "question_set_items" ADD CONSTRAINT "ck_question_set_items_question_version_no" CHECK ("question_version_no" >= 1);
ALTER TABLE "dskp_bidang" ADD CONSTRAINT "ck_dskp_bidang_name" CHECK (char_length(btrim("name")) BETWEEN 1 AND 255);
ALTER TABLE "dskp_bidang" ADD CONSTRAINT "ck_dskp_bidang_code" CHECK ("code" IS NULL OR char_length("code") BETWEEN 1 AND 50);
ALTER TABLE "dskp_sk" ADD CONSTRAINT "ck_dskp_sk_code" CHECK (char_length(btrim("code")) BETWEEN 1 AND 50);
ALTER TABLE "dskp_sk" ADD CONSTRAINT "ck_dskp_sk_description" CHECK (char_length(btrim("description")) BETWEEN 1 AND 2000);
ALTER TABLE "dskp_sp" ADD CONSTRAINT "ck_dskp_sp_code" CHECK (char_length(btrim("code")) BETWEEN 1 AND 50);
ALTER TABLE "dskp_sp" ADD CONSTRAINT "ck_dskp_sp_description" CHECK (char_length(btrim("description")) BETWEEN 1 AND 2000);
