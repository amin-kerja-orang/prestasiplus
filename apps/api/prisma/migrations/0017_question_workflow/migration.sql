-- 0017_question_workflow (BE-10): source_papers, question_status_events, question_reports,
-- question_imports, quality_audits, plus three BE-10-owned helper tables (question_quality_scores,
-- diagram_audit_resolutions, master_notes). Data model 3.4.
-- Hand-written in the style of 0008_curriculum: identity columns, CHECK constraints (enums are
-- text + check), foreign keys to existing tables only.
-- `question_id` columns have NO foreign key on purpose: `questions` belongs to BE-09 (migration
-- 0011), which merges separately. Only question_reports can receive .cloud rows (legacy_* columns).

-- CreateTable
CREATE TABLE "source_papers" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "natural_key" TEXT,
    "content_hash" TEXT,
    "file_hash" TEXT,
    "subject_id" BIGINT,
    "kertas" TEXT,
    "paper_code" TEXT,
    "year" SMALLINT,
    "exam_board" TEXT,
    "exam_type" TEXT,
    "set_label" TEXT,
    "source_kind" TEXT,
    "rights_status" TEXT NOT NULL DEFAULT 'unclear',
    "rights_decision_note" TEXT,
    "rights_decided_by_id" BIGINT,
    "rights_decided_at" TIMESTAMPTZ(6),
    "takedown_at" TIMESTAMPTZ(6),
    "takedown_by_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_papers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_status_events" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "question_id" BIGINT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "actor_user_id" BIGINT,
    "actor_role" TEXT,
    "reason" TEXT,
    "answer_changed" BOOLEAN NOT NULL DEFAULT false,
    "ai_run_id" BIGINT,
    "request_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_reports" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "question_id" BIGINT NOT NULL,
    "question_version_no" INTEGER NOT NULL,
    "question_type" TEXT NOT NULL DEFAULT 'mcq',
    "reporter_id" BIGINT,
    "reasons" TEXT[] NOT NULL,
    "comment" TEXT,
    "source" TEXT NOT NULL,
    "practice_session_id" UUID,
    "attempt_id" UUID,
    "quiz_session_ref" TEXT,
    "room_code" TEXT,
    "source_set" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "admin_notes" TEXT,
    "resolved_by_id" BIGINT,
    "resolved_at" TIMESTAMPTZ(6),
    "fixed_in_version_no" INTEGER,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "question_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_imports" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "file_name" TEXT NOT NULL,
    "template_version" TEXT,
    "imported_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "failures" JSONB NOT NULL DEFAULT '[]',
    "default_subject_id" BIGINT,
    "default_education_level_id" BIGINT,
    "default_difficulty" SMALLINT,
    "created_by_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_audits" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "run_by_id" BIGINT,
    "finished_at" TIMESTAMPTZ(6),
    "finding_count" INTEGER,
    "scored_count" INTEGER,
    "average_score" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_quality_scores" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "question_id" BIGINT NOT NULL,
    "score" SMALLINT NOT NULL,
    "bucket" TEXT NOT NULL,
    "audit_id" BIGINT,
    "scored_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_quality_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagram_audit_resolutions" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "kind" TEXT NOT NULL,
    "question_id" BIGINT NOT NULL,
    "resolution" TEXT NOT NULL,
    "file_id" BIGINT,
    "resolved_by_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagram_audit_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_notes" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "question_id" BIGINT NOT NULL,
    "chapter_label" TEXT,
    "model" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note_text" TEXT NOT NULL,
    "trap_text" TEXT NOT NULL DEFAULT '',
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "teacher_approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_source_papers_natural_key" ON "source_papers"("natural_key");
CREATE INDEX "ix_source_papers_file_hash" ON "source_papers"("file_hash");
CREATE INDEX "ix_source_papers_content_hash" ON "source_papers"("content_hash");
CREATE INDEX "ix_source_papers_subject_id" ON "source_papers"("subject_id");

CREATE INDEX "ix_question_status_events_question_id_created_at" ON "question_status_events"("question_id", "created_at");
CREATE INDEX "ix_question_status_events_actor_user_id" ON "question_status_events"("actor_user_id");

CREATE UNIQUE INDEX "uq_question_reports_reporter_question_version" ON "question_reports"("reporter_id", "question_id", "question_version_no");
CREATE UNIQUE INDEX "uq_question_reports_legacy" ON "question_reports"("legacy_source", "legacy_id");
CREATE INDEX "ix_question_reports_status_created_at" ON "question_reports"("status", "created_at");
CREATE INDEX "ix_question_reports_question_id" ON "question_reports"("question_id");
CREATE INDEX "ix_question_reports_reporter_id_created_at" ON "question_reports"("reporter_id", "created_at");

CREATE INDEX "ix_question_imports_created_at" ON "question_imports"("created_at");
CREATE INDEX "ix_question_imports_created_by_id" ON "question_imports"("created_by_id");

CREATE INDEX "ix_quality_audits_finished_at" ON "quality_audits"("finished_at");

CREATE UNIQUE INDEX "uq_question_quality_scores_question_id" ON "question_quality_scores"("question_id");
CREATE INDEX "ix_question_quality_scores_bucket" ON "question_quality_scores"("bucket");
CREATE INDEX "ix_question_quality_scores_score" ON "question_quality_scores"("score");

CREATE UNIQUE INDEX "uq_diagram_audit_resolutions_kind_question_id" ON "diagram_audit_resolutions"("kind", "question_id");

CREATE INDEX "ix_master_notes_question_id" ON "master_notes"("question_id");
CREATE INDEX "ix_master_notes_flagged" ON "master_notes"("flagged");
CREATE INDEX "ix_master_notes_teacher_approved" ON "master_notes"("teacher_approved");

-- AddForeignKey (existing tables only; question_id has none, see the header)
ALTER TABLE "source_papers" ADD CONSTRAINT "fk_source_papers_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "source_papers" ADD CONSTRAINT "fk_source_papers_rights_decided_by_id" FOREIGN KEY ("rights_decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "source_papers" ADD CONSTRAINT "fk_source_papers_takedown_by_id" FOREIGN KEY ("takedown_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "question_status_events" ADD CONSTRAINT "fk_question_status_events_actor_user_id" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "question_reports" ADD CONSTRAINT "fk_question_reports_reporter_id" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "question_reports" ADD CONSTRAINT "fk_question_reports_resolved_by_id" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "question_imports" ADD CONSTRAINT "fk_question_imports_default_subject_id" FOREIGN KEY ("default_subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "question_imports" ADD CONSTRAINT "fk_question_imports_default_education_level_id" FOREIGN KEY ("default_education_level_id") REFERENCES "education_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "question_imports" ADD CONSTRAINT "fk_question_imports_created_by_id" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_audits" ADD CONSTRAINT "fk_quality_audits_run_by_id" FOREIGN KEY ("run_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "question_quality_scores" ADD CONSTRAINT "fk_question_quality_scores_audit_id" FOREIGN KEY ("audit_id") REFERENCES "quality_audits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "diagram_audit_resolutions" ADD CONSTRAINT "fk_diagram_audit_resolutions_file_id" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "diagram_audit_resolutions" ADD CONSTRAINT "fk_diagram_audit_resolutions_resolved_by_id" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enums are text + check (plan 14.2), English codes.
ALTER TABLE "source_papers" ADD CONSTRAINT "ck_source_papers_exam_type"
  CHECK ("exam_type" IS NULL OR "exam_type" IN ('sebenar', 'percubaan', 'modul', 'topikal', 'latihan'));
ALTER TABLE "source_papers" ADD CONSTRAINT "ck_source_papers_source_kind"
  CHECK ("source_kind" IS NULL OR "source_kind" IN ('lpm_official', 'state_trial', 'school', 'publisher', 'teacher_own', 'ai_variant'));
ALTER TABLE "source_papers" ADD CONSTRAINT "ck_source_papers_rights_status"
  CHECK ("rights_status" IN ('own', 'school', 'official_lpm', 'third_party', 'unclear'));
ALTER TABLE "source_papers" ADD CONSTRAINT "ck_source_papers_year" CHECK ("year" IS NULL OR "year" BETWEEN 1900 AND 2200);

ALTER TABLE "question_status_events" ADD CONSTRAINT "ck_question_status_events_from_status"
  CHECK ("from_status" IS NULL OR "from_status" IN ('draft', 'review', 'approved', 'published', 'archived'));
ALTER TABLE "question_status_events" ADD CONSTRAINT "ck_question_status_events_to_status"
  CHECK ("to_status" IN ('draft', 'review', 'approved', 'published', 'archived'));
ALTER TABLE "question_status_events" ADD CONSTRAINT "ck_question_status_events_version_no" CHECK ("version_no" >= 1);

ALTER TABLE "question_reports" ADD CONSTRAINT "ck_question_reports_reasons"
  CHECK (cardinality("reasons") >= 1 AND "reasons" <@ ARRAY['wrong_answer', 'confusing_question', 'wrong_options', 'missing_options', 'duplicate', 'typo', 'other', 'outdated']::text[]);
ALTER TABLE "question_reports" ADD CONSTRAINT "ck_question_reports_source"
  CHECK ("source" IN ('spm', 'structured_attempt', 'latihan', 'revision', 'teacher_databank', 'quiz', 'papan_bijak'));
ALTER TABLE "question_reports" ADD CONSTRAINT "ck_question_reports_status"
  CHECK ("status" IN ('pending', 'reviewed', 'fixed', 'dismissed'));
ALTER TABLE "question_reports" ADD CONSTRAINT "ck_question_reports_comment" CHECK ("comment" IS NULL OR char_length("comment") <= 500);
ALTER TABLE "question_reports" ADD CONSTRAINT "ck_question_reports_admin_notes" CHECK ("admin_notes" IS NULL OR char_length("admin_notes") <= 1000);
ALTER TABLE "question_reports" ADD CONSTRAINT "ck_question_reports_version_no" CHECK ("question_version_no" >= 1);
ALTER TABLE "question_reports" ADD CONSTRAINT "ck_question_reports_type" CHECK ("question_type" IN ('mcq', 'structured'));
ALTER TABLE "question_reports" ADD CONSTRAINT "ck_question_reports_refs" CHECK (char_length(coalesce("quiz_session_ref", '')) <= 64 AND char_length(coalesce("room_code", '')) <= 64);
ALTER TABLE "question_reports" ADD CONSTRAINT "ck_question_reports_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));

ALTER TABLE "question_imports" ADD CONSTRAINT "ck_question_imports_counts" CHECK ("imported_count" >= 0 AND "failed_count" >= 0);
ALTER TABLE "question_imports" ADD CONSTRAINT "ck_question_imports_default_difficulty"
  CHECK ("default_difficulty" IS NULL OR "default_difficulty" BETWEEN 1 AND 5);
ALTER TABLE "question_imports" ADD CONSTRAINT "ck_question_imports_failures" CHECK (jsonb_typeof("failures") = 'array');

ALTER TABLE "quality_audits" ADD CONSTRAINT "ck_quality_audits_counts"
  CHECK (("finding_count" IS NULL OR "finding_count" >= 0) AND ("scored_count" IS NULL OR "scored_count" >= 0));
ALTER TABLE "quality_audits" ADD CONSTRAINT "ck_quality_audits_average_score"
  CHECK ("average_score" IS NULL OR "average_score" BETWEEN 0 AND 100);

ALTER TABLE "question_quality_scores" ADD CONSTRAINT "ck_question_quality_scores_score" CHECK ("score" BETWEEN 0 AND 100);
ALTER TABLE "question_quality_scores" ADD CONSTRAINT "ck_question_quality_scores_bucket"
  CHECK ("bucket" IN ('cemerlang', 'baik', 'lemah', 'kritikal'));

ALTER TABLE "diagram_audit_resolutions" ADD CONSTRAINT "ck_diagram_audit_resolutions_kind" CHECK ("kind" IN ('mcq', 'structured'));
ALTER TABLE "diagram_audit_resolutions" ADD CONSTRAINT "ck_diagram_audit_resolutions_resolution" CHECK ("resolution" IN ('image', 'dismissed'));

ALTER TABLE "master_notes" ADD CONSTRAINT "ck_master_notes_tokens" CHECK ("tokens" >= 0);
