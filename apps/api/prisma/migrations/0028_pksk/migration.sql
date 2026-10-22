-- 0028_pksk (BE-42, M07): pksk_domains, pksk_packages, pksk_accesses, pksk_exam_attempts, pksk_mastery, pksk_practice_loads.
-- Number 0028 allocated by the LEAD. Hand-written in the style of `prisma migrate diff` output: identity columns
-- (GENERATED ALWAYS), CHECK constraints (enums are text + check) and the foreign keys to `users` (other owner, not Prisma relations).
-- The 15 domains and the 3 packages are REFERENCE data that production needs on day one, so they are inserted here
-- (idempotent: ON CONFLICT DO NOTHING on the natural key), not by a demo seed (open question 8, recorded in the deviations log).
--
-- Reversible: DROP TABLE "pksk_practice_loads", "pksk_mastery", "pksk_exam_attempts", "pksk_accesses", "pksk_packages", "pksk_domains";

-- CreateTable
CREATE TABLE "pksk_domains" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "bahagian" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pksk_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pksk_packages" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "pksk_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pksk_accesses" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "package_id" BIGINT NOT NULL,
    "granted_by_id" BIGINT,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" DATE,
    "status" TEXT NOT NULL DEFAULT 'active',
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "pksk_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pksk_exam_attempts" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "level" TEXT NOT NULL,
    "completed_at" TIMESTAMPTZ(6) NOT NULL,
    "score_pct" DECIMAL(5,1) NOT NULL,
    "bahagian_a_pct" DECIMAL(5,1) NOT NULL,
    "bahagian_b_pct" DECIMAL(5,1) NOT NULL,
    "bahagian_c_pct" DECIMAL(5,1) NOT NULL,
    "grade" TEXT NOT NULL,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pksk_exam_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pksk_mastery" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "level" TEXT NOT NULL,
    "domain_id" BIGINT NOT NULL,
    "mastery_pct" SMALLINT NOT NULL,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pksk_mastery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pksk_practice_loads" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "level" TEXT NOT NULL,
    "domain_id" BIGINT NOT NULL,
    "loaded_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pksk_practice_loads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_pksk_domains_code" ON "pksk_domains"("code");
CREATE INDEX "ix_pksk_domains_bahagian_display_order" ON "pksk_domains"("bahagian", "display_order");
CREATE UNIQUE INDEX "uq_pksk_packages_legacy" ON "pksk_packages"("legacy_source", "legacy_id");
CREATE UNIQUE INDEX "uq_pksk_accesses_legacy" ON "pksk_accesses"("legacy_source", "legacy_id");
CREATE INDEX "ix_pksk_accesses_user_id" ON "pksk_accesses"("user_id");
CREATE INDEX "ix_pksk_accesses_granted_at_id" ON "pksk_accesses"("granted_at" DESC, "id" DESC);
CREATE INDEX "ix_pksk_exam_attempts_user_id_level_completed_at" ON "pksk_exam_attempts"("user_id", "level", "completed_at" DESC);
CREATE UNIQUE INDEX "uq_pksk_mastery_user_id_level_domain_id" ON "pksk_mastery"("user_id", "level", "domain_id");
CREATE UNIQUE INDEX "uq_pksk_practice_loads_user_id_level_domain_id" ON "pksk_practice_loads"("user_id", "level", "domain_id");

-- AddForeignKey
ALTER TABLE "pksk_accesses" ADD CONSTRAINT "fk_pksk_accesses_package_id" FOREIGN KEY ("package_id") REFERENCES "pksk_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pksk_mastery" ADD CONSTRAINT "fk_pksk_mastery_domain_id" FOREIGN KEY ("domain_id") REFERENCES "pksk_domains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pksk_practice_loads" ADD CONSTRAINT "fk_pksk_practice_loads_domain_id" FOREIGN KEY ("domain_id") REFERENCES "pksk_domains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys to users (other owner, not Prisma relations, see pksk.prisma). A deleted grantor leaves the grant; a deleted
-- user takes the grants, attempts, mastery and loads with it.
ALTER TABLE "pksk_accesses" ADD CONSTRAINT "fk_pksk_accesses_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pksk_accesses" ADD CONSTRAINT "fk_pksk_accesses_granted_by_id" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pksk_exam_attempts" ADD CONSTRAINT "fk_pksk_exam_attempts_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pksk_mastery" ADD CONSTRAINT "fk_pksk_mastery_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pksk_practice_loads" ADD CONSTRAINT "fk_pksk_practice_loads_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row convention checks (plan 14.2): legacy_source, on every table that carries the pair. NULL passes a CHECK.
ALTER TABLE "pksk_packages" ADD CONSTRAINT "ck_pksk_packages_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));
ALTER TABLE "pksk_accesses" ADD CONSTRAINT "ck_pksk_accesses_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));

-- Enums as text + check (English codes of @pp/contract: PkskBahagian, PkskPackageLevel, PkskLevel, PkskGrade).
ALTER TABLE "pksk_domains" ADD CONSTRAINT "ck_pksk_domains_bahagian" CHECK ("bahagian" IN ('A', 'B', 'C'));
ALTER TABLE "pksk_packages" ADD CONSTRAINT "ck_pksk_packages_level" CHECK ("level" IN ('T1', 'T4', 'ALL'));
ALTER TABLE "pksk_accesses" ADD CONSTRAINT "ck_pksk_accesses_status" CHECK ("status" IN ('active', 'revoked'));
ALTER TABLE "pksk_exam_attempts" ADD CONSTRAINT "ck_pksk_exam_attempts_level" CHECK ("level" IN ('T1', 'T4'));
ALTER TABLE "pksk_exam_attempts" ADD CONSTRAINT "ck_pksk_exam_attempts_grade" CHECK ("grade" IN ('A', 'B', 'C', 'D', 'E'));
ALTER TABLE "pksk_mastery" ADD CONSTRAINT "ck_pksk_mastery_level" CHECK ("level" IN ('T1', 'T4'));
ALTER TABLE "pksk_practice_loads" ADD CONSTRAINT "ck_pksk_practice_loads_level" CHECK ("level" IN ('T1', 'T4'));

-- Ranges: percentages 0..100; a revoked grant has revoked_at and an active one does not.
ALTER TABLE "pksk_exam_attempts" ADD CONSTRAINT "ck_pksk_exam_attempts_pct" CHECK (
    "score_pct" BETWEEN 0 AND 100 AND "bahagian_a_pct" BETWEEN 0 AND 100 AND "bahagian_b_pct" BETWEEN 0 AND 100 AND "bahagian_c_pct" BETWEEN 0 AND 100);
ALTER TABLE "pksk_mastery" ADD CONSTRAINT "ck_pksk_mastery_mastery_pct" CHECK ("mastery_pct" BETWEEN 0 AND 100);
ALTER TABLE "pksk_accesses" ADD CONSTRAINT "ck_pksk_accesses_revoked_at" CHECK (("status" = 'revoked') = ("revoked_at" IS NOT NULL));

-- Reference rows: the 15 domains in list order (so ids 1 to 15 follow the order; mock data/domains.ts) and the 3 packages.
INSERT INTO "pksk_domains" ("bahagian", "name", "name_en", "code", "icon", "color", "display_order", "created_at", "updated_at") VALUES
    ('A', 'Kecerdasan Insaniah', 'Soft Skills Intelligence', 'PKSK_INSANIAH', 'fa-brain', '#8b5cf6', 1, '2026-02-07T00:57:33+08:00', '2026-02-07T00:57:33+08:00'),
    ('B', 'Matematik', 'Mathematics', 'PKSK_MATH', 'fa-calculator', '#3b82f6', 2, '2026-02-07T00:57:33+08:00', '2026-02-07T00:57:33+08:00'),
    ('B', 'Sains', 'Science', 'PKSK_SCI', 'fa-flask', '#10b981', 3, '2026-02-07T00:57:33+08:00', '2026-02-07T00:57:33+08:00'),
    ('B', 'Bahasa Inggeris', 'English Language', 'PKSK_ENG', 'fa-language', '#ef4444', 4, '2026-02-07T00:57:33+08:00', '2026-02-07T00:57:33+08:00'),
    ('B', 'Sejarah Malaysia', 'Malaysian History', 'PKSK_SEJ', 'fa-landmark', '#f59e0b', 5, '2026-02-07T00:57:33+08:00', '2026-02-07T00:57:33+08:00'),
    ('B', 'Geografi', 'Geography', 'PKSK_GEO', 'fa-globe-asia', '#06b6d4', 6, '2026-02-07T00:57:33+08:00', '2026-02-07T00:57:33+08:00'),
    ('B', 'Kebudayaan Kaum', 'Cultural Heritage', 'PKSK_BUDAYA', 'fa-users', '#ec4899', 7, '2026-02-07T00:57:33+08:00', '2026-02-07T00:57:33+08:00'),
    ('B', 'Sukan & Pencapaian', 'Sports & Achievements', 'PKSK_SUKAN', 'fa-futbol', '#84cc16', 8, '2026-02-07T00:57:33+08:00', '2026-02-07T00:57:33+08:00'),
    ('B', 'Mercu Tanda Malaysia', 'Malaysian Landmarks', 'PKSK_MERCU', 'fa-monument', '#f97316', 9, '2026-02-07T00:57:33+08:00', '2026-02-07T00:57:33+08:00'),
    ('B', 'Alam Sekitar', 'Environment', 'PKSK_ALAM', 'fa-leaf', '#22c55e', 10, '2026-02-07T00:57:33+08:00', '2026-02-07T00:57:33+08:00'),
    ('B', 'Teknologi & IT', 'Technology & IT', 'PKSK_TECH', 'fa-laptop-code', '#6366f1', 11, '2026-02-07T00:57:33+08:00', '2026-02-07T00:57:33+08:00'),
    ('B', 'Ekonomi Malaysia', 'Malaysian Economy', 'PKSK_EKON', 'fa-chart-line', '#14b8a6', 12, '2026-02-07T00:57:33+08:00', '2026-02-07T00:57:33+08:00'),
    ('B', 'Inovasi & Pencipta', 'Innovation & Inventors', 'PKSK_INOV', 'fa-lightbulb', '#eab308', 13, '2026-02-07T00:57:33+08:00', '2026-02-07T00:57:33+08:00'),
    ('B', 'Isu Global', 'Global Issues', 'PKSK_GLOBAL', 'fa-earth-asia', '#0ea5e9', 14, '2026-02-07T00:57:33+08:00', '2026-02-07T00:57:33+08:00'),
    ('C', 'Artikulasi Penulisan', 'Writing Articulation', 'PKSK_ESSAY', 'fa-pen-fancy', '#a855f7', 15, '2026-02-07T00:57:33+08:00', '2026-02-07T00:57:33+08:00')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "pksk_packages" ("name", "level") VALUES
    ('PKSK Tingkatan 1 (SBP/MRSM)', 'T1'),
    ('PKSK Tingkatan 4 (SBP/MRSM)', 'T4'),
    ('PKSK Kombo (T1 + T4)', 'ALL');
