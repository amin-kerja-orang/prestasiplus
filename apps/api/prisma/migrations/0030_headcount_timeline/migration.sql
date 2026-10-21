-- 0030_headcount_timeline (BE-19 completion): headcount_configs, headcount_entries, headcount_entry_marks (M08 headcount) and
-- timeline_posts, timeline_post_photos (Prestasi timeline). Number 0030 allocated by the LEAD.
-- Hand-written in the style of `prisma migrate diff` output: identity columns (GENERATED ALWAYS), CHECK constraints (enums are
-- text + check) and the foreign keys, none of which the Prisma schema declares as relations (see reports.prisma).
-- spm_history is NOT created: no route of the merged contract reads it (only trend.years would, and it stays neutral).
-- This migration needs users (0002), classrooms (0015), subjects and education_levels (0008) and files (0005).

-- CreateTable
CREATE TABLE "headcount_configs" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "teacher_id" BIGINT NOT NULL,
    "classroom_id" BIGINT NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "education_level_id" BIGINT NOT NULL,
    "academic_year" SMALLINT NOT NULL,
    "active_otrs" SMALLINT NOT NULL,
    "mode" TEXT NOT NULL,
    "legacy_tov" DECIMAL(5,2),
    "legacy_rs" DECIMAL(5,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "headcount_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "headcount_entries" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "config_id" BIGINT NOT NULL,
    "student_id" BIGINT NOT NULL,
    "tov" DECIMAL(5,2),
    "etr" DECIMAL(5,2),
    "rs" DECIMAL(5,2),
    "rs_recorded_at" TIMESTAMPTZ(6),
    "dropped" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "headcount_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "headcount_entry_marks" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "entry_id" BIGINT NOT NULL,
    "checkpoint" SMALLINT NOT NULL,
    "target" DECIMAL(5,2),
    "actual" DECIMAL(5,2),

    CONSTRAINT "headcount_entry_marks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_posts" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "event_date" DATE,
    "story" TEXT,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "timeline_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_post_photos" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "post_id" BIGINT NOT NULL,
    "file_id" BIGINT NOT NULL,
    "caption" TEXT,
    "position" SMALLINT NOT NULL,

    CONSTRAINT "timeline_post_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_headcount_configs_class_subject_year_mode" ON "headcount_configs"("classroom_id", "subject_id", "academic_year", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "uq_headcount_configs_legacy" ON "headcount_configs"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_headcount_configs_teacher_id" ON "headcount_configs"("teacher_id");

-- CreateIndex
CREATE INDEX "ix_headcount_configs_classroom_id" ON "headcount_configs"("classroom_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_headcount_entries_config_id_student_id" ON "headcount_entries"("config_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_headcount_entries_legacy" ON "headcount_entries"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_headcount_entries_student_id" ON "headcount_entries"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_headcount_entry_marks_entry_id_checkpoint" ON "headcount_entry_marks"("entry_id", "checkpoint");

-- CreateIndex
CREATE UNIQUE INDEX "uq_timeline_posts_legacy" ON "timeline_posts"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_timeline_posts_user_id_created_at" ON "timeline_posts"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_timeline_post_photos_post_id_position" ON "timeline_post_photos"("post_id", "position");

-- CreateIndex
CREATE INDEX "ix_timeline_post_photos_file_id" ON "timeline_post_photos"("file_id");

-- Foreign keys inside this migration. Deleting a config takes its entries, and an entry its marks; deleting a post takes its photos.
ALTER TABLE "headcount_entries" ADD CONSTRAINT "fk_headcount_entries_config_id" FOREIGN KEY ("config_id") REFERENCES "headcount_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "headcount_entry_marks" ADD CONSTRAINT "fk_headcount_entry_marks_entry_id" FOREIGN KEY ("entry_id") REFERENCES "headcount_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timeline_post_photos" ADD CONSTRAINT "fk_timeline_post_photos_post_id" FOREIGN KEY ("post_id") REFERENCES "timeline_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys to tables of other owners (not Prisma relations, see reports.prisma).
-- A deleted teacher, class or pupil takes the config, entry or posts with them; a subject or level in use cannot be deleted;
-- a file that a post still shows cannot be deleted.
ALTER TABLE "headcount_configs" ADD CONSTRAINT "fk_headcount_configs_teacher_id" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "headcount_configs" ADD CONSTRAINT "fk_headcount_configs_classroom_id" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "headcount_configs" ADD CONSTRAINT "fk_headcount_configs_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "headcount_configs" ADD CONSTRAINT "fk_headcount_configs_education_level_id" FOREIGN KEY ("education_level_id") REFERENCES "education_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "headcount_entries" ADD CONSTRAINT "fk_headcount_entries_student_id" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timeline_posts" ADD CONSTRAINT "fk_timeline_posts_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timeline_post_photos" ADD CONSTRAINT "fk_timeline_post_photos_file_id" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row convention checks (plan 14.2): legacy_source, on every table that carries the pair. NULL passes a CHECK.
ALTER TABLE "headcount_configs" ADD CONSTRAINT "ck_headcount_configs_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));
ALTER TABLE "headcount_entries" ADD CONSTRAINT "ck_headcount_entries_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));
ALTER TABLE "timeline_posts" ADD CONSTRAINT "ck_timeline_posts_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));

-- Enums as text + check (English codes of @pp/contract: PerformanceHeadcountMode, the timeline categories).
ALTER TABLE "headcount_configs" ADD CONSTRAINT "ck_headcount_configs_mode" CHECK ("mode" IN ('auto', 'manual'));
ALTER TABLE "timeline_posts" ADD CONSTRAINT "ck_timeline_posts_category" CHECK ("category" IN ('sijil', 'pencapaian', 'aktiviti', 'cerita', 'lain'));

-- Ranges: OTR count 2 to 5, academic year 2020 to 2100, percentages 0 to 100, checkpoint 1 to 5.
ALTER TABLE "headcount_configs" ADD CONSTRAINT "ck_headcount_configs_active_otrs" CHECK ("active_otrs" BETWEEN 2 AND 5);
ALTER TABLE "headcount_configs" ADD CONSTRAINT "ck_headcount_configs_academic_year" CHECK ("academic_year" BETWEEN 2020 AND 2100);
ALTER TABLE "headcount_configs" ADD CONSTRAINT "ck_headcount_configs_legacy_tov" CHECK ("legacy_tov" IS NULL OR "legacy_tov" BETWEEN 0 AND 100);
ALTER TABLE "headcount_configs" ADD CONSTRAINT "ck_headcount_configs_legacy_rs" CHECK ("legacy_rs" IS NULL OR "legacy_rs" BETWEEN 0 AND 100);
ALTER TABLE "headcount_entries" ADD CONSTRAINT "ck_headcount_entries_tov" CHECK ("tov" IS NULL OR "tov" BETWEEN 0 AND 100);
ALTER TABLE "headcount_entries" ADD CONSTRAINT "ck_headcount_entries_etr" CHECK ("etr" IS NULL OR "etr" BETWEEN 0 AND 100);
ALTER TABLE "headcount_entries" ADD CONSTRAINT "ck_headcount_entries_rs" CHECK ("rs" IS NULL OR "rs" BETWEEN 0 AND 100);
ALTER TABLE "headcount_entry_marks" ADD CONSTRAINT "ck_headcount_entry_marks_checkpoint" CHECK ("checkpoint" BETWEEN 1 AND 5);
ALTER TABLE "headcount_entry_marks" ADD CONSTRAINT "ck_headcount_entry_marks_target" CHECK ("target" IS NULL OR "target" BETWEEN 0 AND 100);
ALTER TABLE "headcount_entry_marks" ADD CONSTRAINT "ck_headcount_entry_marks_actual" CHECK ("actual" IS NULL OR "actual" BETWEEN 0 AND 100);

-- Timeline limits of the contract: title 1 to 150 characters, story at most 2000, caption at most 200, position not negative.
ALTER TABLE "timeline_posts" ADD CONSTRAINT "ck_timeline_posts_title" CHECK (char_length(btrim("title")) BETWEEN 1 AND 150);
ALTER TABLE "timeline_posts" ADD CONSTRAINT "ck_timeline_posts_story" CHECK ("story" IS NULL OR char_length("story") <= 2000);
ALTER TABLE "timeline_post_photos" ADD CONSTRAINT "ck_timeline_post_photos_caption" CHECK ("caption" IS NULL OR char_length("caption") <= 200);
ALTER TABLE "timeline_post_photos" ADD CONSTRAINT "ck_timeline_post_photos_position" CHECK ("position" >= 0);
