-- 0037_ai_extraction (BE-36): ai_extraction_runs, ai_usage_logs, ai_settings (owner module: ai-extraction).
-- Hand-written in the style of 0005 / 0020 / 0026: identity columns (GENERATED ALWAYS), CHECK constraints (enums are
-- text + check, English codes, no Postgres enum types), named constraints (ck_*, fk_*, uq_*, ix_*).
-- Depends on: users (0002), intake_batches / intake_files / jobs (0020).
--
-- Provider code in the database is `openai_compatible` (underscore); the wire code is `openai-compatible`
-- (data model enum E-ai_provider, plan 15.2). The service maps between the two. BE-40 reads `ai_usage_logs.provider`
-- and `ai_settings.monthly_budget_sen` by these names.
--
-- ai_usage_logs: append-only (G-17: only created_at, no UPDATE or DELETE path in code), NO content of any kind
-- (BE-NFR-33). It is the only migratable table of this card (BE-29 may load the .cloud cost log optionally): it carries
-- legacy_source, legacy_id and the unique pair, and is listed in migratable-models.json. `event` and `tool` hold the
-- .cloud values of migrated rows and stay null for rows written by this service (plan 14.7, OD-23). `purpose` is the
-- contract's AiCallPurpose of a row written here; migrated rows keep the default.
-- ai_extraction_runs and ai_settings are NOT migratable: no .cloud data lands there, so no legacy columns.
-- ai_settings is a singleton (check id = 1); the service creates the row on first need (seeded from AI_MONTHLY_BUDGET_SEN),
-- so a fresh database has no row and the environment value is the cap (BE-40 relies on this fallback).
--
-- Reversible: DROP TABLE ai_usage_logs, ai_extraction_runs, ai_settings;

-- CreateTable
CREATE TABLE "ai_extraction_runs" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "batch_id" BIGINT,
    "intake_file_id" BIGINT,
    "job_id" BIGINT,
    "kind" TEXT NOT NULL DEFAULT 'extract_paper',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "requested_by_id" BIGINT,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "pages" INTEGER,
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "cost_sen" INTEGER,
    "error_code" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_extraction_runs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_ai_extraction_runs_kind" CHECK ("kind" IN ('extract_paper', 'suggest_tags')),
    CONSTRAINT "ck_ai_extraction_runs_provider" CHECK ("provider" IN ('mock', 'anthropic', 'openai', 'gemini', 'openai_compatible')),
    CONSTRAINT "ck_ai_extraction_runs_status" CHECK ("status" IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
    CONSTRAINT "ck_ai_extraction_runs_counts" CHECK (
        ("pages" IS NULL OR "pages" >= 0) AND ("tokens_in" IS NULL OR "tokens_in" >= 0)
        AND ("tokens_out" IS NULL OR "tokens_out" >= 0) AND ("cost_sen" IS NULL OR "cost_sen" >= 0)
    ),
    CONSTRAINT "ck_ai_extraction_runs_error_code" CHECK ("error_code" IS NULL OR "error_code" ~ '^[A-Z][A-Z0-9_]{1,63}$')
);

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "run_id" BIGINT,
    "batch_id" BIGINT,
    "actor_user_id" BIGINT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'generate_text',
    "pages" INTEGER NOT NULL DEFAULT 0,
    "tokens_in" INTEGER NOT NULL DEFAULT 0,
    "tokens_out" INTEGER NOT NULL DEFAULT 0,
    "cost_sen" INTEGER NOT NULL DEFAULT 0,
    "event" TEXT,
    "tool" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_ai_usage_logs_provider" CHECK ("provider" IN ('mock', 'anthropic', 'openai', 'gemini', 'openai_compatible')),
    CONSTRAINT "ck_ai_usage_logs_purpose" CHECK ("purpose" IN ('extract_paper', 'suggest_tags', 'generate_text', 'health_check')),
    CONSTRAINT "ck_ai_usage_logs_counts" CHECK ("pages" >= 0 AND "tokens_in" >= 0 AND "tokens_out" >= 0 AND "cost_sen" >= 0),
    CONSTRAINT "ck_ai_usage_logs_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'))
);

-- CreateTable
CREATE TABLE "ai_settings" (
    "id" SMALLINT NOT NULL,
    "monthly_budget_sen" INTEGER NOT NULL,
    "warn_percent" SMALLINT NOT NULL DEFAULT 80,
    "notify_at_80" BOOLEAN NOT NULL DEFAULT true,
    "notify_at_100" BOOLEAN NOT NULL DEFAULT true,
    "last_warned_month" DATE,
    "last_capped_month" DATE,
    "updated_by_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_ai_settings_singleton" CHECK ("id" = 1),
    CONSTRAINT "ck_ai_settings_monthly_budget_sen" CHECK ("monthly_budget_sen" >= 0),
    CONSTRAINT "ck_ai_settings_warn_percent" CHECK ("warn_percent" BETWEEN 1 AND 100)
);

-- CreateIndex
CREATE INDEX "ix_ai_extraction_runs_batch_id" ON "ai_extraction_runs"("batch_id");
CREATE INDEX "ix_ai_extraction_runs_intake_file_id" ON "ai_extraction_runs"("intake_file_id");
CREATE INDEX "ix_ai_extraction_runs_job_id" ON "ai_extraction_runs"("job_id");
CREATE INDEX "ix_ai_extraction_runs_requested_by_id" ON "ai_extraction_runs"("requested_by_id");
CREATE INDEX "ix_ai_extraction_runs_status" ON "ai_extraction_runs"("status");

CREATE INDEX "ix_ai_usage_logs_created_at" ON "ai_usage_logs"("created_at");
CREATE INDEX "ix_ai_usage_logs_batch_id" ON "ai_usage_logs"("batch_id");
CREATE INDEX "ix_ai_usage_logs_run_id" ON "ai_usage_logs"("run_id");
CREATE INDEX "ix_ai_usage_logs_actor_user_id" ON "ai_usage_logs"("actor_user_id");
CREATE UNIQUE INDEX "uq_ai_usage_logs_legacy" ON "ai_usage_logs"("legacy_source", "legacy_id");

CREATE INDEX "ix_ai_settings_updated_by_id" ON "ai_settings"("updated_by_id");

-- AddForeignKey
ALTER TABLE "ai_extraction_runs" ADD CONSTRAINT "fk_ai_extraction_runs_batch_id" FOREIGN KEY ("batch_id") REFERENCES "intake_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_extraction_runs" ADD CONSTRAINT "fk_ai_extraction_runs_intake_file_id" FOREIGN KEY ("intake_file_id") REFERENCES "intake_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_extraction_runs" ADD CONSTRAINT "fk_ai_extraction_runs_job_id" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_extraction_runs" ADD CONSTRAINT "fk_ai_extraction_runs_requested_by_id" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "fk_ai_usage_logs_run_id" FOREIGN KEY ("run_id") REFERENCES "ai_extraction_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "fk_ai_usage_logs_batch_id" FOREIGN KEY ("batch_id") REFERENCES "intake_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "fk_ai_usage_logs_actor_user_id" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_settings" ADD CONSTRAINT "fk_ai_settings_updated_by_id" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
