-- 0020_ai_intake (BE-37): renumber-at-merge, LEAD to confirm.
-- intake_batches (the question-paper Submission, D53/OWN-1), intake_files, intake_pages, intake_figures and the
-- platform `jobs` table. Hand-written in the style of 0005: identity columns (GENERATED ALWAYS), CHECK constraints
-- (enums are text + check, English codes), named constraints (ck_*, fk_*, uq_*, ix_*).
-- NOT migratable: no .cloud rows land here, so no legacy_* columns; the tables are not in migratable-models.json.
-- intake_batches.subject is a subject code with no FK to `subjects` yet (deferred).
-- Reversible: DROP TABLE intake_figures, intake_pages, intake_files, intake_batches, jobs CASCADE.

-- CreateTable
CREATE TABLE "intake_batches" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "owner_user_id" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "paper_type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "kertas" SMALLINT NOT NULL,
    "year" SMALLINT NOT NULL,
    "source_text" TEXT NOT NULL,
    "rights_status" TEXT NOT NULL,
    "note" TEXT,
    "admin_notes" TEXT,
    "status_reason" TEXT,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "submitted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intake_batches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_intake_batches_status" CHECK ("status" IN ('submitted', 'processing', 'ready_for_review', 'failed', 'cancelled')),
    CONSTRAINT "ck_intake_batches_paper_type" CHECK ("paper_type" IN ('trial', 'general', 'exam', 'exercise_book', 'other')),
    CONSTRAINT "ck_intake_batches_subject" CHECK ("subject" ~ '^[A-Z0-9]{2,32}$'),
    CONSTRAINT "ck_intake_batches_kertas" CHECK ("kertas" IN (1, 2)),
    CONSTRAINT "ck_intake_batches_year" CHECK ("year" BETWEEN 1990 AND 2100),
    CONSTRAINT "ck_intake_batches_source_text" CHECK (char_length("source_text") <= 200),
    CONSTRAINT "ck_intake_batches_rights_status" CHECK ("rights_status" IN ('own', 'official_lpm', 'third_party')),
    CONSTRAINT "ck_intake_batches_note" CHECK ("note" IS NULL OR char_length("note") <= 1000),
    CONSTRAINT "ck_intake_batches_admin_notes" CHECK ("admin_notes" IS NULL OR char_length("admin_notes") <= 1000)
);

-- CreateTable
CREATE TABLE "intake_files" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "batch_id" BIGINT NOT NULL,
    "file_id" BIGINT NOT NULL,
    "original_name" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "page_count" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "error_code" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intake_files_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_intake_files_original_name" CHECK (char_length("original_name") BETWEEN 1 AND 255),
    CONSTRAINT "ck_intake_files_sha256" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "ck_intake_files_size_bytes" CHECK ("size_bytes" > 0),
    CONSTRAINT "ck_intake_files_page_count" CHECK ("page_count" IS NULL OR "page_count" >= 1),
    CONSTRAINT "ck_intake_files_status" CHECK ("status" IN ('uploaded', 'processing', 'done', 'failed', 'cancelled')),
    CONSTRAINT "ck_intake_files_error_code" CHECK ("error_code" IS NULL OR "error_code" ~ '^[A-Z][A-Z0-9_]{1,63}$')
);

-- CreateTable
CREATE TABLE "intake_pages" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "intake_file_id" BIGINT NOT NULL,
    "page_no" INTEGER NOT NULL,
    "image_file_id" BIGINT,
    "thumb_file_id" BIGINT,
    "width" INTEGER,
    "height" INTEGER,
    "text" TEXT,
    "text_source" TEXT,
    "ocr_confidence" DECIMAL(5,2),
    "has_text_layer" BOOLEAN NOT NULL DEFAULT false,
    "ocr_status" TEXT NOT NULL DEFAULT 'pending',
    "ocr_blocks" JSONB,
    "error_code" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intake_pages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_intake_pages_page_no" CHECK ("page_no" >= 1),
    CONSTRAINT "ck_intake_pages_size" CHECK (("width" IS NULL OR "width" > 0) AND ("height" IS NULL OR "height" > 0)),
    CONSTRAINT "ck_intake_pages_text_source" CHECK ("text_source" IS NULL OR "text_source" IN ('text_layer', 'ocr')),
    CONSTRAINT "ck_intake_pages_ocr_confidence" CHECK ("ocr_confidence" IS NULL OR "ocr_confidence" BETWEEN 0 AND 100),
    CONSTRAINT "ck_intake_pages_ocr_status" CHECK ("ocr_status" IN ('pending', 'not_needed', 'done', 'failed')),
    CONSTRAINT "ck_intake_pages_error_code" CHECK ("error_code" IS NULL OR "error_code" ~ '^[A-Z][A-Z0-9_]{1,63}$')
);

-- CreateTable
CREATE TABLE "intake_figures" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "intake_page_id" BIGINT NOT NULL,
    "bbox" JSONB NOT NULL,
    "crop_file_id" BIGINT,
    "alt_text_suggestion" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intake_figures_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_intake_figures_alt_text_suggestion" CHECK ("alt_text_suggestion" IS NULL OR char_length("alt_text_suggestion") <= 500)
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "type" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "payload" JSONB,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "run_after" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotency_key" TEXT NOT NULL,
    "locked_at" TIMESTAMPTZ(6),
    "locked_by" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "error_code" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_jobs_type" CHECK ("type" ~ '^[a-z][a-z0-9_.]{1,63}$'),
    CONSTRAINT "ck_jobs_state" CHECK ("state" IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
    CONSTRAINT "ck_jobs_attempts" CHECK ("attempts" >= 0),
    CONSTRAINT "ck_jobs_max_attempts" CHECK ("max_attempts" BETWEEN 1 AND 20),
    CONSTRAINT "ck_jobs_error_code" CHECK ("error_code" IS NULL OR char_length("error_code") <= 64)
);

-- CreateIndex
CREATE INDEX "ix_intake_batches_owner_user_id_status" ON "intake_batches"("owner_user_id", "status");
CREATE INDEX "ix_intake_batches_status_created_at" ON "intake_batches"("status", "created_at");

CREATE INDEX "ix_intake_files_sha256" ON "intake_files"("sha256");
CREATE INDEX "ix_intake_files_batch_id" ON "intake_files"("batch_id");

CREATE UNIQUE INDEX "uq_intake_pages_intake_file_id_page_no" ON "intake_pages"("intake_file_id", "page_no");

CREATE INDEX "ix_intake_figures_intake_page_id" ON "intake_figures"("intake_page_id");

CREATE UNIQUE INDEX "uq_jobs_idempotency_key" ON "jobs"("idempotency_key");
CREATE INDEX "ix_jobs_entity_type_entity_id" ON "jobs"("entity_type", "entity_id");
-- Partial index for the claim query (FOR UPDATE SKIP LOCKED over due queued jobs); Prisma cannot express it.
CREATE INDEX "ix_jobs_queued" ON "jobs"("run_after") WHERE "state" = 'queued';

-- AddForeignKey
ALTER TABLE "intake_batches" ADD CONSTRAINT "fk_intake_batches_owner_user_id" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "intake_files" ADD CONSTRAINT "fk_intake_files_batch_id" FOREIGN KEY ("batch_id") REFERENCES "intake_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "intake_files" ADD CONSTRAINT "fk_intake_files_file_id" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "intake_pages" ADD CONSTRAINT "fk_intake_pages_intake_file_id" FOREIGN KEY ("intake_file_id") REFERENCES "intake_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "intake_pages" ADD CONSTRAINT "fk_intake_pages_image_file_id" FOREIGN KEY ("image_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "intake_pages" ADD CONSTRAINT "fk_intake_pages_thumb_file_id" FOREIGN KEY ("thumb_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "intake_figures" ADD CONSTRAINT "fk_intake_figures_intake_page_id" FOREIGN KEY ("intake_page_id") REFERENCES "intake_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "intake_figures" ADD CONSTRAINT "fk_intake_figures_crop_file_id" FOREIGN KEY ("crop_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
