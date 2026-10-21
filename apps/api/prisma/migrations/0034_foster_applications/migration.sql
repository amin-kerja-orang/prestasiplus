-- 0034_foster_applications (BE-47): foster_applications (M21 Sponsorship, student side: Mohon Keluarga Angkat).
-- Hand-written in the style of `prisma migrate diff` output: identity column (GENERATED ALWAYS), CHECK constraints
-- (enums are text + check, no Postgres enum types), the descending status index and the foreign keys to users, which the
-- Prisma schema does not declare as relations (see sponsorship.prisma). Plan 14.2, data model 3.13.
-- legacy_source/legacy_id exist for the migration kit (G-02); nothing is loaded in B1 (data migration Q7).

-- CreateTable
CREATE TABLE "foster_applications" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "student_id" BIGINT NOT NULL,
    "applicant_user_id" BIGINT NOT NULL,
    "applicant_role" TEXT NOT NULL,
    "student_category" TEXT NOT NULL,
    "family_income_range" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "foster_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_foster_applications_legacy" ON "foster_applications"("legacy_source", "legacy_id");

-- CreateIndex (the later admin review queue: by status, newest first)
CREATE INDEX "ix_foster_applications_status_created_at" ON "foster_applications"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ix_foster_applications_student_id" ON "foster_applications"("student_id");

-- CreateIndex
CREATE INDEX "ix_foster_applications_applicant_user_id" ON "foster_applications"("applicant_user_id");

-- Foreign keys to users (not Prisma relations, see sponsorship.prisma). The application is personal data of the family of
-- the student and of its applicant, so it goes with either user.
ALTER TABLE "foster_applications" ADD CONSTRAINT "fk_foster_applications_student_id" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "foster_applications" ADD CONSTRAINT "fk_foster_applications_applicant_user_id" FOREIGN KEY ("applicant_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row convention check (plan 14.2): legacy_source. NULL passes a CHECK.
ALTER TABLE "foster_applications" ADD CONSTRAINT "ck_foster_applications_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));

-- Enums as text + check (wire values of @pp/contract: KeluargaAngkatCategory, KeluargaAngkatIncomeRange, statuses).
ALTER TABLE "foster_applications" ADD CONSTRAINT "ck_foster_applications_student_category" CHECK ("student_category" IN ('B40', 'Asnaf', 'Yatim', 'OKU', 'Lain-lain'));
ALTER TABLE "foster_applications" ADD CONSTRAINT "ck_foster_applications_family_income_range" CHECK ("family_income_range" IS NULL OR "family_income_range" IN ('< RM1,000', 'RM1,000 - RM2,500', 'RM2,500 - RM4,000', '> RM4,000'));
ALTER TABLE "foster_applications" ADD CONSTRAINT "ck_foster_applications_status" CHECK ("status" IN ('pending', 'approved', 'matched', 'rejected'));
