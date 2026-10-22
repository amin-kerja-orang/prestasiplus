-- 0038_intake_workflow (BE-38): intake extraction runs, stimuli, items, item events and duplicate links, plus the
-- nullable intake_batches.source_paper_id pointer. Number 0038 allocated by the LEAD.
-- Hand-written in the style of 0020: identity columns (GENERATED ALWAYS), CHECK constraints (enums are text + check,
-- English codes), named constraints (ck_*, fk_*, uq_*, ix_*). The foreign keys to other owners' tables are here only.
-- NOT migratable: pipeline tables are archived, so no legacy_* columns and no entry in migratable-models.json.
-- Needs intake_batches/files/pages/figures and jobs (0020), users (0002), questions (0011), source_papers (0017).
-- Reversible: ALTER TABLE intake_batches DROP COLUMN source_paper_id;
--   DROP TABLE duplicate_links, intake_item_events, intake_items, intake_stimuli, intake_extraction_runs CASCADE.

-- AlterTable
ALTER TABLE "intake_batches" ADD COLUMN "source_paper_id" BIGINT;

-- CreateTable
CREATE TABLE "intake_extraction_runs" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "batch_id" BIGINT NOT NULL,
    "job_id" BIGINT,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "reason_code" TEXT,
    "item_count" INTEGER,
    "provider" TEXT,
    "model" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "requested_by_id" BIGINT,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "unmatched" JSONB NOT NULL DEFAULT '[]',
    "queued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intake_extraction_runs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_intake_extraction_runs_state" CHECK ("state" IN ('queued', 'running', 'succeeded', 'failed')),
    CONSTRAINT "ck_intake_extraction_runs_reason_code" CHECK ("reason_code" IS NULL OR "reason_code" IN ('AI_BUDGET_EXHAUSTED', 'AI_UNAVAILABLE', 'EXTRACTION_FAILED')),
    CONSTRAINT "ck_intake_extraction_runs_item_count" CHECK ("item_count" IS NULL OR "item_count" >= 0),
    CONSTRAINT "ck_intake_extraction_runs_attempts" CHECK ("attempts" >= 0),
    CONSTRAINT "ck_intake_extraction_runs_provider" CHECK ("provider" IS NULL OR char_length("provider") <= 64),
    CONSTRAINT "ck_intake_extraction_runs_model" CHECK ("model" IS NULL OR char_length("model") <= 128)
);

-- CreateTable
CREATE TABLE "intake_stimuli" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "batch_id" BIGINT NOT NULL,
    "ref" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "caption" TEXT,
    "alt_text" TEXT NOT NULL DEFAULT '',
    "body" TEXT,
    "table_data" JSONB,
    "figure_id" BIGINT,
    "page_no" INTEGER,
    "region" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intake_stimuli_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_intake_stimuli_kind" CHECK ("kind" IN ('diagram', 'passage', 'table')),
    CONSTRAINT "ck_intake_stimuli_ref" CHECK (char_length("ref") BETWEEN 1 AND 64),
    CONSTRAINT "ck_intake_stimuli_label" CHECK (char_length("label") <= 100),
    CONSTRAINT "ck_intake_stimuli_caption" CHECK ("caption" IS NULL OR char_length("caption") <= 300),
    CONSTRAINT "ck_intake_stimuli_alt_text" CHECK (char_length("alt_text") <= 1000),
    CONSTRAINT "ck_intake_stimuli_page_no" CHECK ("page_no" IS NULL OR "page_no" >= 1)
);

-- CreateTable
CREATE TABLE "intake_items" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "batch_id" BIGINT NOT NULL,
    "intake_file_id" BIGINT,
    "intake_page_id" BIGINT,
    "ai_run_id" BIGINT,
    "stimulus_id" BIGINT,
    "position" INTEGER NOT NULL,
    "source_type" TEXT NOT NULL DEFAULT 'pdf',
    "number_label" TEXT NOT NULL DEFAULT '',
    "item_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "page_no" INTEGER NOT NULL DEFAULT 1,
    "region" JSONB,
    "low_fields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "confirmed_fields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "needs_manual" BOOLEAN NOT NULL DEFAULT false,
    "field_confidence" JSONB NOT NULL DEFAULT '{}',
    "lowest_confidence" DECIMAL(4,3),
    "human_edited" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "review_state" TEXT NOT NULL DEFAULT 'generated',
    "reject_reason" TEXT,
    "decided_by_id" BIGINT,
    "decided_at" TIMESTAMPTZ(6),
    "question_id" BIGINT,
    "question_version_no" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intake_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_intake_items_position" CHECK ("position" >= 1),
    CONSTRAINT "ck_intake_items_source_type" CHECK ("source_type" IN ('pdf', 'manual')),
    CONSTRAINT "ck_intake_items_number_label" CHECK (char_length("number_label") <= 32),
    CONSTRAINT "ck_intake_items_item_type" CHECK ("item_type" IN ('mcq', 'structured', 'short', 'essay')),
    CONSTRAINT "ck_intake_items_page_no" CHECK ("page_no" BETWEEN 1 AND 10000),
    CONSTRAINT "ck_intake_items_lowest_confidence" CHECK ("lowest_confidence" IS NULL OR "lowest_confidence" BETWEEN 0 AND 1),
    CONSTRAINT "ck_intake_items_review_state" CHECK ("review_state" IN ('generated', 'needs_review', 'accepted', 'rejected', 'duplicate')),
    CONSTRAINT "ck_intake_items_reject_reason" CHECK ("reject_reason" IS NULL OR char_length("reject_reason") <= 500),
    -- A rejected item always keeps its reason; only an accepted item points at a question. The link may become NULL later: deleting the Draf question
    -- sets it to NULL (fk ON DELETE SET NULL) and the item stays accepted, history intact.
    CONSTRAINT "ck_intake_items_rejected_reason" CHECK ("review_state" <> 'rejected' OR "reject_reason" IS NOT NULL),
    CONSTRAINT "ck_intake_items_accepted_question" CHECK ("question_id" IS NULL OR "review_state" = 'accepted'),
    CONSTRAINT "ck_intake_items_question_version_no" CHECK ("question_version_no" IS NULL OR "question_version_no" >= 1)
);

-- CreateTable
CREATE TABLE "intake_item_events" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "item_id" BIGINT NOT NULL,
    "actor_user_id" BIGINT,
    "actor_role" TEXT,
    "event" TEXT NOT NULL,
    "from_state" TEXT,
    "to_state" TEXT,
    "field" TEXT,
    "before_value" JSONB,
    "after_value" JSONB,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intake_item_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_intake_item_events_event" CHECK ("event" IN ('extracted', 'added', 'edited', 'confirmed', 'accepted', 'rejected', 'marked_duplicate', 'cleared_duplicate', 'linked_variant')),
    CONSTRAINT "ck_intake_item_events_from_state" CHECK ("from_state" IS NULL OR "from_state" IN ('generated', 'needs_review', 'accepted', 'rejected', 'duplicate')),
    CONSTRAINT "ck_intake_item_events_to_state" CHECK ("to_state" IS NULL OR "to_state" IN ('generated', 'needs_review', 'accepted', 'rejected', 'duplicate')),
    CONSTRAINT "ck_intake_item_events_field" CHECK ("field" IS NULL OR char_length("field") BETWEEN 1 AND 64),
    CONSTRAINT "ck_intake_item_events_reason" CHECK ("reason" IS NULL OR char_length("reason") <= 500)
);

-- CreateTable
CREATE TABLE "duplicate_links" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "item_id" BIGINT NOT NULL,
    "matched_question_id" BIGINT,
    "matched_item_id" BIGINT,
    "kind" TEXT NOT NULL,
    "similarity" DECIMAL(4,3),
    "decision" TEXT NOT NULL DEFAULT 'pending',
    "decided_by_id" BIGINT,
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duplicate_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_duplicate_links_kind" CHECK ("kind" IN ('exact', 'near', 'variant')),
    CONSTRAINT "ck_duplicate_links_similarity" CHECK ("similarity" IS NULL OR "similarity" BETWEEN 0 AND 1),
    CONSTRAINT "ck_duplicate_links_decision" CHECK ("decision" IN ('pending', 'not_duplicate', 'merged', 'linked_variant')),
    -- Exactly one of the two matched columns is set.
    CONSTRAINT "ck_duplicate_links_target" CHECK (("matched_question_id" IS NULL) <> ("matched_item_id" IS NULL))
);

-- CreateIndex
CREATE INDEX "ix_intake_extraction_runs_batch_id_created_at" ON "intake_extraction_runs"("batch_id", "created_at");
-- One queued or running run per batch (Prisma cannot express a partial unique index): makes "enqueue" idempotent under races.
CREATE UNIQUE INDEX "uq_intake_extraction_runs_active" ON "intake_extraction_runs"("batch_id") WHERE "state" IN ('queued', 'running');

CREATE UNIQUE INDEX "uq_intake_stimuli_batch_id_ref" ON "intake_stimuli"("batch_id", "ref");

CREATE INDEX "ix_intake_items_batch_id_review_state" ON "intake_items"("batch_id", "review_state");
CREATE INDEX "ix_intake_items_review_state_lowest_confidence" ON "intake_items"("review_state", "lowest_confidence");
CREATE INDEX "ix_intake_items_batch_id_position" ON "intake_items"("batch_id", "position");
CREATE INDEX "ix_intake_items_stimulus_id" ON "intake_items"("stimulus_id");
CREATE INDEX "ix_intake_items_question_id" ON "intake_items"("question_id");

CREATE INDEX "ix_intake_item_events_item_id_created_at" ON "intake_item_events"("item_id", "created_at");

CREATE INDEX "ix_duplicate_links_item_id" ON "duplicate_links"("item_id");
CREATE INDEX "ix_duplicate_links_matched_item_id" ON "duplicate_links"("matched_item_id");
CREATE INDEX "ix_duplicate_links_matched_question_id" ON "duplicate_links"("matched_question_id");
-- A finding exists once per item and target (partial: the other column is null).
CREATE UNIQUE INDEX "uq_duplicate_links_item_question" ON "duplicate_links"("item_id", "matched_question_id") WHERE "matched_question_id" IS NOT NULL;
CREATE UNIQUE INDEX "uq_duplicate_links_item_item" ON "duplicate_links"("item_id", "matched_item_id") WHERE "matched_item_id" IS NOT NULL;
CREATE INDEX "ix_intake_batches_source_paper_id" ON "intake_batches"("source_paper_id");

-- AddForeignKey
ALTER TABLE "intake_batches" ADD CONSTRAINT "fk_intake_batches_source_paper_id" FOREIGN KEY ("source_paper_id") REFERENCES "source_papers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "intake_extraction_runs" ADD CONSTRAINT "fk_intake_extraction_runs_batch_id" FOREIGN KEY ("batch_id") REFERENCES "intake_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "intake_extraction_runs" ADD CONSTRAINT "fk_intake_extraction_runs_job_id" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "intake_extraction_runs" ADD CONSTRAINT "fk_intake_extraction_runs_requested_by_id" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "intake_stimuli" ADD CONSTRAINT "fk_intake_stimuli_batch_id" FOREIGN KEY ("batch_id") REFERENCES "intake_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "intake_stimuli" ADD CONSTRAINT "fk_intake_stimuli_figure_id" FOREIGN KEY ("figure_id") REFERENCES "intake_figures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "intake_items" ADD CONSTRAINT "fk_intake_items_batch_id" FOREIGN KEY ("batch_id") REFERENCES "intake_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "intake_items" ADD CONSTRAINT "fk_intake_items_intake_file_id" FOREIGN KEY ("intake_file_id") REFERENCES "intake_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "intake_items" ADD CONSTRAINT "fk_intake_items_intake_page_id" FOREIGN KEY ("intake_page_id") REFERENCES "intake_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "intake_items" ADD CONSTRAINT "fk_intake_items_ai_run_id" FOREIGN KEY ("ai_run_id") REFERENCES "intake_extraction_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "intake_items" ADD CONSTRAINT "fk_intake_items_stimulus_id" FOREIGN KEY ("stimulus_id") REFERENCES "intake_stimuli"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "intake_items" ADD CONSTRAINT "fk_intake_items_decided_by_id" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "intake_items" ADD CONSTRAINT "fk_intake_items_question_id" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "intake_item_events" ADD CONSTRAINT "fk_intake_item_events_item_id" FOREIGN KEY ("item_id") REFERENCES "intake_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "intake_item_events" ADD CONSTRAINT "fk_intake_item_events_actor_user_id" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "duplicate_links" ADD CONSTRAINT "fk_duplicate_links_item_id" FOREIGN KEY ("item_id") REFERENCES "intake_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "duplicate_links" ADD CONSTRAINT "fk_duplicate_links_matched_question_id" FOREIGN KEY ("matched_question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "duplicate_links" ADD CONSTRAINT "fk_duplicate_links_matched_item_id" FOREIGN KEY ("matched_item_id") REFERENCES "intake_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "duplicate_links" ADD CONSTRAINT "fk_duplicate_links_decided_by_id" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
