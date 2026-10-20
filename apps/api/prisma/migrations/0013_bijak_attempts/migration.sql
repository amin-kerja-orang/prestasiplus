-- 0013_bijak_attempts (BE-16): exam_attempts, attempt_answers, attempt_photos, attempt_results, attempt_checks.
-- Hand-written in the style of 0008: identity columns (GENERATED ALWAYS), CHECK constraints (enums are
-- text + check), partial indexes. Data model 3.8 (docs/architecture/v2-data-model.md).
--
-- NO foreign keys to `papers` / `questions` / `question_parts` yet: BE-15 (migration 0012) and BE-09 (0011) own
-- them and may not be merged when this file is applied. `exam_attempts.paper_id` is a nullable bigint; the
-- ids of questions and parts are opaque text (an MCQ part id IS its question id on the wire). Follow-up
-- migration (after BE-15 lands): ALTER TABLE exam_attempts ADD CONSTRAINT fk_exam_attempts_paper_id FOREIGN KEY
-- (paper_id) REFERENCES papers(id) ON DELETE SET NULL.
--
-- Reversible: DROP TABLE attempt_checks, attempt_results, attempt_photos, attempt_answers, exam_attempts CASCADE.

-- CreateTable
CREATE TABLE "exam_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" BIGINT NOT NULL,
    "paper_id" BIGINT,
    "paper_kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "subject_name" TEXT NOT NULL,
    "kertas" INTEGER NOT NULL,
    "paper_code" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "deadline_at" TIMESTAMPTZ(6),
    "duration_min" INTEGER NOT NULL,
    "composition" JSONB NOT NULL DEFAULT '[]',
    "flags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "picks" JSONB NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMPTZ(6),
    "late_by_seconds" INTEGER,
    "idempotency_key" TEXT,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_exam_attempts_paper_kind" CHECK ("paper_kind" IN ('pilihan', 'jana')),
    CONSTRAINT "ck_exam_attempts_mode" CHECK ("mode" IN ('exam', 'latihan')),
    CONSTRAINT "ck_exam_attempts_status" CHECK ("status" IN ('in_progress', 'submitted', 'auto_submitted', 'abandoned')),
    CONSTRAINT "ck_exam_attempts_kertas" CHECK ("kertas" >= 1),
    CONSTRAINT "ck_exam_attempts_duration_min" CHECK ("duration_min" >= 1),
    CONSTRAINT "ck_exam_attempts_position" CHECK ("position" >= 0),
    CONSTRAINT "ck_exam_attempts_late_by_seconds" CHECK ("late_by_seconds" IS NULL OR "late_by_seconds" >= 0),
    CONSTRAINT "ck_exam_attempts_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'))
);

-- CreateTable
CREATE TABLE "attempt_answers" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "attempt_id" UUID NOT NULL,
    "part_id" TEXT NOT NULL,
    "answer" JSONB NOT NULL,
    "rev" INTEGER NOT NULL DEFAULT 0,
    "saved_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempt_answers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_attempt_answers_rev" CHECK ("rev" >= 0)
);

-- CreateTable
CREATE TABLE "attempt_photos" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "attempt_id" UUID NOT NULL,
    "part_id" TEXT NOT NULL,
    "file_id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempt_photos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_attempt_photos_size_bytes" CHECK ("size_bytes" >= 0 AND "size_bytes" <= 5242880)
);

-- CreateTable
CREATE TABLE "attempt_results" (
    "attempt_id" UUID NOT NULL,
    "score" DECIMAL(7,2) NOT NULL,
    "max_score" DECIMAL(7,2) NOT NULL,
    "provisional" BOOLEAN NOT NULL DEFAULT false,
    "pending_review" INTEGER NOT NULL DEFAULT 0,
    "coins" INTEGER,
    "points" INTEGER,
    "graded" JSONB NOT NULL,
    "section_scores" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempt_results_pkey" PRIMARY KEY ("attempt_id"),
    CONSTRAINT "ck_attempt_results_score" CHECK ("score" >= 0 AND "max_score" >= 0),
    CONSTRAINT "ck_attempt_results_pending_review" CHECK ("pending_review" >= 0)
);

-- CreateTable
CREATE TABLE "attempt_checks" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "attempt_id" UUID NOT NULL,
    "question_id" TEXT NOT NULL,
    "check_count" SMALLINT NOT NULL DEFAULT 1,
    "result" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempt_checks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_attempt_checks_check_count" CHECK ("check_count" BETWEEN 1 AND 3)
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_exam_attempts_legacy" ON "exam_attempts"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_exam_attempts_user_id_started_at" ON "exam_attempts"("user_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "ix_exam_attempts_user_id_paper_id_status" ON "exam_attempts"("user_id", "paper_id", "status");

-- CreateIndex (the sweeper: open exam attempts by deadline)
CREATE INDEX "ix_exam_attempts_open_deadline" ON "exam_attempts"("deadline_at") WHERE "status" = 'in_progress' AND "deadline_at" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "uq_attempt_answers_attempt_id_part_id" ON "attempt_answers"("attempt_id", "part_id");

-- CreateIndex
CREATE INDEX "ix_attempt_photos_attempt_id_part_id" ON "attempt_photos"("attempt_id", "part_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_attempt_photos_file_id" ON "attempt_photos"("file_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_attempt_checks_attempt_id_question_id" ON "attempt_checks"("attempt_id", "question_id");

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "fk_exam_attempts_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "fk_attempt_answers_attempt_id" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_photos" ADD CONSTRAINT "fk_attempt_photos_attempt_id" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_photos" ADD CONSTRAINT "fk_attempt_photos_file_id" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_results" ADD CONSTRAINT "fk_attempt_results_attempt_id" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_checks" ADD CONSTRAINT "fk_attempt_checks_attempt_id" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
