-- 0013_classes (BE-17): classrooms, enrolments, teacher_profiles (M10 part A).
-- Number 0013 allocated by the LEAD. Hand-written in the style of `prisma migrate diff` output: identity columns
-- (GENERATED ALWAYS), CHECK constraints (enums are text + check), the case-insensitive unique index on the join code
-- and the foreign keys to tables of other owners (users, schools, subjects, education_levels), which the Prisma schema
-- does not declare as relations (see classes.prisma). Plan 14.2, data model 3.9.

-- CreateTable
CREATE TABLE "classrooms" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'classroom',
    "name" TEXT NOT NULL,
    "teacher_id" BIGINT,
    "school_id" BIGINT,
    "subject_id" BIGINT,
    "education_level_id" BIGINT NOT NULL,
    "academic_year" SMALLINT NOT NULL,
    "description" TEXT,
    "join_code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrolments" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "classroom_id" BIGINT NOT NULL,
    "student_id" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL DEFAULT 'code',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "enrolments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_profiles" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "subject" TEXT,
    "qualification" TEXT,
    "experience_years" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "teacher_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_classrooms_legacy" ON "classrooms"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_classrooms_teacher_id_created_at" ON "classrooms"("teacher_id", "created_at");

-- CreateIndex
CREATE INDEX "ix_classrooms_school_id_is_active" ON "classrooms"("school_id", "is_active");

-- CreateIndex
CREATE INDEX "ix_classrooms_subject_id" ON "classrooms"("subject_id");

-- CreateIndex
CREATE INDEX "ix_classrooms_education_level_id" ON "classrooms"("education_level_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_enrolments_classroom_id_student_id" ON "enrolments"("classroom_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_enrolments_legacy" ON "enrolments"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_enrolments_student_id_status" ON "enrolments"("student_id", "status");

-- CreateIndex
CREATE INDEX "ix_enrolments_classroom_id_status" ON "enrolments"("classroom_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_teacher_profiles_user_id" ON "teacher_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_teacher_profiles_legacy" ON "teacher_profiles"("legacy_source", "legacy_id");

-- AddForeignKey
ALTER TABLE "enrolments" ADD CONSTRAINT "fk_enrolments_classroom_id" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys to tables of other owners (not Prisma relations, see classes.prisma).
-- A deleted teacher leaves the class without an owner; a deleted student leaves the roster; a school or level in use cannot be deleted.
ALTER TABLE "classrooms" ADD CONSTRAINT "fk_classrooms_teacher_id" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "classrooms" ADD CONSTRAINT "fk_classrooms_school_id" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "classrooms" ADD CONSTRAINT "fk_classrooms_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "classrooms" ADD CONSTRAINT "fk_classrooms_education_level_id" FOREIGN KEY ("education_level_id") REFERENCES "education_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enrolments" ADD CONSTRAINT "fk_enrolments_student_id" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "fk_teacher_profiles_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row convention checks (plan 14.2): legacy_source, on every table that carries the pair. NULL passes a CHECK.
ALTER TABLE "classrooms" ADD CONSTRAINT "ck_classrooms_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));
ALTER TABLE "enrolments" ADD CONSTRAINT "ck_enrolments_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "ck_teacher_profiles_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));

-- Enums as text + check (English codes of @pp/contract: ClassroomKind, ClassEnrolmentStatus, ClassEnrolmentSource).
ALTER TABLE "classrooms" ADD CONSTRAINT "ck_classrooms_kind" CHECK ("kind" IN ('classroom', 'school_class'));
ALTER TABLE "enrolments" ADD CONSTRAINT "ck_enrolments_status" CHECK ("status" IN ('active', 'removed'));
ALTER TABLE "enrolments" ADD CONSTRAINT "ck_enrolments_source" CHECK ("source" IN ('code', 'teacher', 'school_admin', 'complimentary'));

-- A teacher class has an owner when created; the name is never blank; a join code is never blank.
ALTER TABLE "classrooms" ADD CONSTRAINT "ck_classrooms_name" CHECK (char_length(btrim("name")) BETWEEN 1 AND 255);
ALTER TABLE "classrooms" ADD CONSTRAINT "ck_classrooms_join_code" CHECK ("join_code" IS NULL OR char_length(btrim("join_code")) >= 1);
ALTER TABLE "classrooms" ADD CONSTRAINT "ck_classrooms_academic_year" CHECK ("academic_year" BETWEEN 2000 AND 2100);
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "ck_teacher_profiles_experience_years" CHECK ("experience_years" >= 0);

-- Join codes are compared ignoring case ("abc123" joins the class "ABC123"), so they are unique ignoring case.
CREATE UNIQUE INDEX "uq_classrooms_join_code_upper" ON "classrooms" (upper("join_code"));
