-- 0023_reports_analytics_kirkpatrick (BE-20): monitoring_flags (M11), feedback and interventions (M12).
-- NOTE: the number 0023 is provisional: renumber at merge, LEAD to confirm.
-- Hand-written in the style of `prisma migrate diff` output: identity columns (GENERATED ALWAYS), CHECK constraints
-- (enums are text + check) and the foreign keys to tables of other owners (users, schools), which the Prisma schema
-- does not declare as relations (see reports.prisma). Plan 14.2, data model 3.10.

-- CreateTable
CREATE TABLE "monitoring_flags" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "level" TEXT NOT NULL,
    "flagged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monitoring_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "role" TEXT NOT NULL,
    "school_id" BIGINT,
    "month" DATE NOT NULL,
    "nps" SMALLINT,
    "satisfaction" SMALLINT NOT NULL,
    "usability" SMALLINT,
    "relevance" SMALLINT,
    "score" SMALLINT,
    "comment" TEXT,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interventions" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "student_id" BIGINT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "action_date" DATE NOT NULL,
    "alert_description" TEXT NOT NULL,
    "action_taken" TEXT NOT NULL,
    "before_accuracy" DECIMAL(5,2),
    "after_accuracy" DECIMAL(5,2),
    "before_mood" TEXT,
    "after_mood" TEXT,
    "created_by_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "interventions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_monitoring_flags_user_id" ON "monitoring_flags"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_feedback_user_id_month_is_test" ON "feedback"("user_id", "month", "is_test");

-- CreateIndex
CREATE UNIQUE INDEX "uq_feedback_legacy" ON "feedback"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_feedback_school_id_month" ON "feedback"("school_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "uq_interventions_legacy" ON "interventions"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_interventions_student_id_action_date" ON "interventions"("student_id", "action_date");

-- CreateIndex
CREATE INDEX "ix_interventions_created_by_id" ON "interventions"("created_by_id");

-- Foreign keys to tables of other owners (not Prisma relations, see reports.prisma).
-- A deleted pupil takes the flag, feedback and interventions with them; the author of an intervention cannot be
-- deleted while interventions reference it; a deleted school leaves the feedback with a null school (snapshot).
ALTER TABLE "monitoring_flags" ADD CONSTRAINT "fk_monitoring_flags_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback" ADD CONSTRAINT "fk_feedback_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback" ADD CONSTRAINT "fk_feedback_school_id" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "interventions" ADD CONSTRAINT "fk_interventions_student_id" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interventions" ADD CONSTRAINT "fk_interventions_created_by_id" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row convention checks (plan 14.2): legacy_source, on every table that carries the pair. NULL passes a CHECK.
ALTER TABLE "feedback" ADD CONSTRAINT "ck_feedback_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));
ALTER TABLE "interventions" ADD CONSTRAINT "ck_interventions_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));

-- Enums as text + check (English codes of @pp/contract: E-flag_level, E-role, E-alert_type, E-mood).
ALTER TABLE "monitoring_flags" ADD CONSTRAINT "ck_monitoring_flags_level" CHECK ("level" IN ('review', 'excluded'));
ALTER TABLE "feedback" ADD CONSTRAINT "ck_feedback_role"
  CHECK ("role" IN ('admin', 'school_admin', 'ppd_officer', 'teacher', 'student', 'parent', 'sponsor'));
ALTER TABLE "interventions" ADD CONSTRAINT "ck_interventions_alert_type" CHECK ("alert_type" IN ('mood', 'inactive', 'declining'));
ALTER TABLE "interventions" ADD CONSTRAINT "ck_interventions_before_mood" CHECK ("before_mood" IS NULL OR "before_mood" IN ('happy', 'okay', 'sad', 'stressed'));
ALTER TABLE "interventions" ADD CONSTRAINT "ck_interventions_after_mood" CHECK ("after_mood" IS NULL OR "after_mood" IN ('happy', 'okay', 'sad', 'stressed'));

-- Range checks: NPS 0 to 10 (null for migrated rows), satisfaction 1 to 5, the other .cloud scores 1 to 5, accuracy 0 to 100.
ALTER TABLE "feedback" ADD CONSTRAINT "ck_feedback_nps" CHECK ("nps" IS NULL OR "nps" BETWEEN 0 AND 10);
ALTER TABLE "feedback" ADD CONSTRAINT "ck_feedback_satisfaction" CHECK ("satisfaction" BETWEEN 1 AND 5);
ALTER TABLE "feedback" ADD CONSTRAINT "ck_feedback_usability" CHECK ("usability" IS NULL OR "usability" BETWEEN 1 AND 5);
ALTER TABLE "feedback" ADD CONSTRAINT "ck_feedback_relevance" CHECK ("relevance" IS NULL OR "relevance" BETWEEN 1 AND 5);
ALTER TABLE "feedback" ADD CONSTRAINT "ck_feedback_score" CHECK ("score" IS NULL OR "score" BETWEEN 1 AND 5);
ALTER TABLE "interventions" ADD CONSTRAINT "ck_interventions_before_accuracy" CHECK ("before_accuracy" IS NULL OR "before_accuracy" BETWEEN 0 AND 100);
ALTER TABLE "interventions" ADD CONSTRAINT "ck_interventions_after_accuracy" CHECK ("after_accuracy" IS NULL OR "after_accuracy" BETWEEN 0 AND 100);
