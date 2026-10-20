-- 0014_practice_write (BE-12, owner module M05): practice_sessions, practice_session_questions (OD-28),
-- practice_answers, practice_checks, revision_queue, mastery, subject_usage, and the US-33 attempt aggregate
-- (practice_attempt_aggregates, practice_attempt_aggregate_items). Data model 3.6.
-- Hand-written in the style of 0008: identity columns (GENERATED ALWAYS), CHECK constraints (enums are
-- text + check), a partial unique index for the client idempotency key.
--
-- NO foreign keys to `questions` (BE-09, 0011), `missions` / `remedial_tests` / `question_sets` (BE-18),
-- `papers` (BE-15) or `exam_attempts` (BE-16): those cards may not be merged when this file is applied.
-- Follow-up migration once BE-09 lands (deviations log, BE-12 rows):
--   ALTER TABLE practice_answers ADD CONSTRAINT fk_practice_answers_question_id FOREIGN KEY (question_id)
--     REFERENCES questions(id) ON DELETE SET NULL;           -- history survives a deleted question
--   ALTER TABLE practice_session_questions / practice_checks / revision_queue ... REFERENCES questions(id)
--     ON DELETE CASCADE;                                    -- served lists, checks and the queue go with it
--   ALTER TABLE practice_sessions ADD CONSTRAINT fk_practice_sessions_target_question_id ... ON DELETE SET NULL;
-- ON DELETE of the other parents: users CASCADE (the learner's own data goes with the account); curriculum
-- dimensions SET NULL on sessions and answers (snapshot dimensions, history is kept), CASCADE on the
-- per-subject counters (revision_queue, mastery, subject_usage).
--
-- Reversible: DROP TABLE practice_attempt_aggregate_items, practice_attempt_aggregates, subject_usage, mastery,
-- revision_queue, practice_checks, practice_answers, practice_session_questions, practice_sessions CASCADE.

-- CreateTable
CREATE TABLE "practice_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" BIGINT NOT NULL,
    "client_uuid" UUID,
    "mode" TEXT NOT NULL,
    "subject_id" BIGINT,
    "education_level_id" BIGINT,
    "difficulty" SMALLINT,
    "chapter_id" BIGINT,
    "year" SMALLINT,
    "set_no" SMALLINT,
    "target_question_id" BIGINT,
    "mission_id" BIGINT,
    "remedial_test_id" BIGINT,
    "question_set_id" BIGINT,
    "time_limit_sec" INTEGER,
    "pksk_domain" TEXT,
    "pksk_target_level" TEXT,
    "question_count" SMALLINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "correct_count" SMALLINT NOT NULL DEFAULT 0,
    "time_spent_sec" INTEGER NOT NULL DEFAULT 0,
    "coins_earned" INTEGER NOT NULL DEFAULT 0,
    "points_earned" INTEGER NOT NULL DEFAULT 0,
    "coins_per_correct" INTEGER,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "legacy_paper" TEXT,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,
    "legacy_hash" TEXT,

    CONSTRAINT "practice_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_practice_sessions_mode" CHECK ("mode" IN ('random', 'chapter', 'revision', 'past_year', 'latih_tubi', 'ramalan', 'mission', 'remedial', 'question_set', 'pksk')),
    CONSTRAINT "ck_practice_sessions_status" CHECK ("status" IN ('in_progress', 'completed')),
    CONSTRAINT "ck_practice_sessions_pksk_target_level" CHECK ("pksk_target_level" IS NULL OR "pksk_target_level" IN ('T1', 'T4')),
    CONSTRAINT "ck_practice_sessions_counts" CHECK ("question_count" >= 0 AND "correct_count" >= 0 AND "correct_count" <= "question_count"),
    CONSTRAINT "ck_practice_sessions_non_negative" CHECK ("time_spent_sec" >= 0 AND "coins_earned" >= 0 AND "points_earned" >= 0 AND ("coins_per_correct" IS NULL OR "coins_per_correct" >= 0) AND ("time_limit_sec" IS NULL OR "time_limit_sec" >= 0)),
    CONSTRAINT "ck_practice_sessions_completed_at" CHECK (("status" = 'completed') = ("completed_at" IS NOT NULL)),
    CONSTRAINT "ck_practice_sessions_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'))
);

-- CreateTable
CREATE TABLE "practice_session_questions" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "session_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "question_id" BIGINT NOT NULL,
    "question_version_no" INTEGER NOT NULL,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_session_questions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_practice_session_questions_position" CHECK ("position" >= 0),
    CONSTRAINT "ck_practice_session_questions_version" CHECK ("question_version_no" >= 1)
);

-- CreateTable
CREATE TABLE "practice_answers" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "session_id" UUID,
    "user_id" BIGINT NOT NULL,
    "question_id" BIGINT,
    "question_version_no" INTEGER,
    "subject_id" BIGINT,
    "education_level_id" BIGINT,
    "chapter_id" BIGINT,
    "topic_id" BIGINT,
    "difficulty" SMALLINT,
    "question_type" TEXT,
    "selected_label" TEXT,
    "is_correct" BOOLEAN NOT NULL,
    "time_seconds" INTEGER,
    "answered_at" TIMESTAMPTZ(6) NOT NULL,
    "historical" BOOLEAN NOT NULL DEFAULT false,
    "client_uuid" UUID,
    "legacy_question_ref" TEXT,
    "legacy_content_hash" TEXT,
    "source_natural_key" TEXT,
    "number_label" TEXT,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,
    "legacy_hash" TEXT,

    CONSTRAINT "practice_answers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_practice_answers_link" CHECK ("question_id" IS NOT NULL OR "subject_id" IS NOT NULL),
    CONSTRAINT "ck_practice_answers_selected_label" CHECK ("selected_label" IS NULL OR "selected_label" ~ '^[A-H]$'),
    CONSTRAINT "ck_practice_answers_time_seconds" CHECK ("time_seconds" IS NULL OR "time_seconds" >= 0),
    CONSTRAINT "ck_practice_answers_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'))
);

-- CreateTable
CREATE TABLE "practice_checks" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" BIGINT NOT NULL,
    "question_id" BIGINT NOT NULL,
    "question_version_no" INTEGER NOT NULL,
    "selected_label" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "checked_at" TIMESTAMPTZ(6) NOT NULL,
    "seq" SMALLINT NOT NULL,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_checks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_practice_checks_selected_label" CHECK ("selected_label" ~ '^[A-H]$'),
    CONSTRAINT "ck_practice_checks_seq" CHECK ("seq" >= 1)
);

-- CreateTable
CREATE TABLE "revision_queue" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "question_id" BIGINT NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "wrong_times" INTEGER NOT NULL DEFAULT 1,
    "last_wrong_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revision_queue_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_revision_queue_wrong_times" CHECK ("wrong_times" >= 1)
);

-- CreateTable
CREATE TABLE "mastery" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "answered" INTEGER NOT NULL DEFAULT 0,
    "last_answered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mastery_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_mastery_counts" CHECK ("correct" >= 0 AND "answered" >= 0 AND "correct" <= "answered")
);

-- CreateTable
CREATE TABLE "subject_usage" (
    "subject_id" BIGINT NOT NULL,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_usage_pkey" PRIMARY KEY ("subject_id"),
    CONSTRAINT "ck_subject_usage_used_count" CHECK ("used_count" >= 0)
);

-- CreateTable
CREATE TABLE "practice_attempt_aggregates" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "source" TEXT NOT NULL,
    "attempt_id" UUID NOT NULL,
    "user_id" BIGINT NOT NULL,
    "paper_id" BIGINT,
    "start_type" TEXT,
    "subject_code" TEXT NOT NULL,
    "kertas" SMALLINT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "units_awarded" DECIMAL(7,2) NOT NULL,
    "units_max" DECIMAL(7,2) NOT NULL,
    "duration_sec" INTEGER,
    "provisional" BOOLEAN NOT NULL DEFAULT false,
    "regrade_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(6),
    "submitted_at" TIMESTAMPTZ(6),
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_attempt_aggregates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_practice_attempt_aggregates_source" CHECK ("source" IN ('bijak')),
    CONSTRAINT "ck_practice_attempt_aggregates_start_type" CHECK ("start_type" IS NULL OR "start_type" IN ('pilihan', 'jana')),
    CONSTRAINT "ck_practice_attempt_aggregates_mode" CHECK ("mode" IN ('exam', 'latihan')),
    CONSTRAINT "ck_practice_attempt_aggregates_status" CHECK ("status" IN ('submitted', 'auto_submitted')),
    CONSTRAINT "ck_practice_attempt_aggregates_kertas" CHECK ("kertas" >= 1),
    CONSTRAINT "ck_practice_attempt_aggregates_units" CHECK ("units_awarded" >= 0 AND "units_max" >= 0 AND "units_awarded" <= "units_max"),
    CONSTRAINT "ck_practice_attempt_aggregates_non_negative" CHECK ("regrade_count" >= 0 AND ("duration_sec" IS NULL OR "duration_sec" >= 0))
);

-- CreateTable
CREATE TABLE "practice_attempt_aggregate_items" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "aggregate_id" BIGINT NOT NULL,
    "position" SMALLINT NOT NULL,
    "question_id" TEXT NOT NULL,
    "marks" DECIMAL(7,2) NOT NULL,
    "awarded" DECIMAL(7,2) NOT NULL,
    "attempted" BOOLEAN NOT NULL,
    "counted" BOOLEAN NOT NULL,
    "is_test" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "practice_attempt_aggregate_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_practice_attempt_aggregate_items_position" CHECK ("position" >= 0),
    CONSTRAINT "ck_practice_attempt_aggregate_items_marks" CHECK ("marks" >= 0 AND "awarded" >= 0 AND "awarded" <= "marks")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_practice_sessions_legacy" ON "practice_sessions"("legacy_source", "legacy_id");
CREATE UNIQUE INDEX "uq_practice_sessions_user_id_client_uuid" ON "practice_sessions"("user_id", "client_uuid") WHERE "client_uuid" IS NOT NULL;
CREATE INDEX "ix_practice_sessions_user_id_started_at" ON "practice_sessions"("user_id", "started_at" DESC);
CREATE INDEX "ix_practice_sessions_user_id_status" ON "practice_sessions"("user_id", "status");
CREATE INDEX "ix_practice_sessions_subject_id" ON "practice_sessions"("subject_id");
CREATE INDEX "ix_practice_sessions_user_id_completed_at" ON "practice_sessions"("user_id", "completed_at" DESC) WHERE "status" = 'completed';

CREATE UNIQUE INDEX "uq_practice_session_questions_session_id_position" ON "practice_session_questions"("session_id", "position");
CREATE UNIQUE INDEX "uq_practice_session_questions_session_id_question_id" ON "practice_session_questions"("session_id", "question_id");

CREATE UNIQUE INDEX "uq_practice_answers_legacy" ON "practice_answers"("legacy_source", "legacy_id");
CREATE INDEX "ix_practice_answers_user_id_subject_id_answered_at" ON "practice_answers"("user_id", "subject_id", "answered_at");
CREATE INDEX "ix_practice_answers_session_id" ON "practice_answers"("session_id");
CREATE INDEX "ix_practice_answers_user_id_question_id" ON "practice_answers"("user_id", "question_id");
CREATE INDEX "ix_practice_answers_subject_id_chapter_id" ON "practice_answers"("subject_id", "chapter_id");

CREATE UNIQUE INDEX "uq_practice_checks_session_id_question_id" ON "practice_checks"("session_id", "question_id");

CREATE UNIQUE INDEX "uq_revision_queue_user_id_question_id" ON "revision_queue"("user_id", "question_id");
CREATE INDEX "ix_revision_queue_user_id_subject_id" ON "revision_queue"("user_id", "subject_id");

CREATE UNIQUE INDEX "uq_mastery_user_id_subject_id" ON "mastery"("user_id", "subject_id");

CREATE UNIQUE INDEX "uq_practice_attempt_aggregates_source_attempt_id" ON "practice_attempt_aggregates"("source", "attempt_id");
CREATE INDEX "ix_practice_attempt_aggregates_user_id_submitted_at" ON "practice_attempt_aggregates"("user_id", "submitted_at" DESC);
CREATE INDEX "ix_practice_attempt_aggregates_subject_code_kertas" ON "practice_attempt_aggregates"("subject_code", "kertas");
CREATE INDEX "ix_practice_attempt_aggregates_paper_id" ON "practice_attempt_aggregates"("paper_id");

CREATE UNIQUE INDEX "uq_practice_attempt_aggregate_items_aggregate_id_position" ON "practice_attempt_aggregate_items"("aggregate_id", "position");
CREATE INDEX "ix_practice_attempt_aggregate_items_question_id" ON "practice_attempt_aggregate_items"("question_id");

-- AddForeignKey: users (CASCADE)
ALTER TABLE "practice_sessions" ADD CONSTRAINT "fk_practice_sessions_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "practice_answers" ADD CONSTRAINT "fk_practice_answers_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "practice_checks" ADD CONSTRAINT "fk_practice_checks_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "revision_queue" ADD CONSTRAINT "fk_revision_queue_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mastery" ADD CONSTRAINT "fk_mastery_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "practice_attempt_aggregates" ADD CONSTRAINT "fk_practice_attempt_aggregates_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: within practice (CASCADE)
ALTER TABLE "practice_session_questions" ADD CONSTRAINT "fk_practice_session_questions_session_id" FOREIGN KEY ("session_id") REFERENCES "practice_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "practice_answers" ADD CONSTRAINT "fk_practice_answers_session_id" FOREIGN KEY ("session_id") REFERENCES "practice_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "practice_checks" ADD CONSTRAINT "fk_practice_checks_session_id" FOREIGN KEY ("session_id") REFERENCES "practice_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "practice_attempt_aggregate_items" ADD CONSTRAINT "fk_practice_attempt_aggregate_items_aggregate_id" FOREIGN KEY ("aggregate_id") REFERENCES "practice_attempt_aggregates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: curriculum dimensions (SET NULL on sessions and answers, CASCADE on counters)
ALTER TABLE "practice_sessions" ADD CONSTRAINT "fk_practice_sessions_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "practice_sessions" ADD CONSTRAINT "fk_practice_sessions_education_level_id" FOREIGN KEY ("education_level_id") REFERENCES "education_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "practice_sessions" ADD CONSTRAINT "fk_practice_sessions_chapter_id" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "practice_answers" ADD CONSTRAINT "fk_practice_answers_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "practice_answers" ADD CONSTRAINT "fk_practice_answers_education_level_id" FOREIGN KEY ("education_level_id") REFERENCES "education_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "practice_answers" ADD CONSTRAINT "fk_practice_answers_chapter_id" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "practice_answers" ADD CONSTRAINT "fk_practice_answers_topic_id" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "revision_queue" ADD CONSTRAINT "fk_revision_queue_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mastery" ADD CONSTRAINT "fk_mastery_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subject_usage" ADD CONSTRAINT "fk_subject_usage_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
