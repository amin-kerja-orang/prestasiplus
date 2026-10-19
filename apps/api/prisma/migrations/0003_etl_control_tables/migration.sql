-- CreateTable
CREATE TABLE "etl_runs" (
    "id" BIGSERIAL NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'dry-run',
    "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "entity_set" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "git_sha" TEXT,
    "input_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "counters" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etl_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etl_checkpoints" (
    "id" BIGSERIAL NOT NULL,
    "run_id" BIGINT NOT NULL,
    "entity" TEXT NOT NULL,
    "last_key" TEXT,
    "batch" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etl_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etl_id_map" (
    "id" BIGSERIAL NOT NULL,
    "legacy_source" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "legacy_id" TEXT NOT NULL,
    "new_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etl_id_map_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etl_rejects" (
    "id" BIGSERIAL NOT NULL,
    "run_id" BIGINT NOT NULL,
    "entity" TEXT NOT NULL,
    "legacy_id" TEXT,
    "reason" TEXT NOT NULL,
    "column_name" TEXT,
    "offending" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etl_rejects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etl_recon" (
    "id" BIGSERIAL NOT NULL,
    "run_id" BIGINT NOT NULL,
    "entity" TEXT NOT NULL,
    "source_count" INTEGER NOT NULL,
    "eligible_count" INTEGER NOT NULL,
    "loaded" INTEGER NOT NULL,
    "rejected" INTEGER NOT NULL,
    "expected_delta" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etl_recon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_etl_runs_mode_input_status" ON "etl_runs"("mode", "input_hash", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_etl_checkpoints_run_entity" ON "etl_checkpoints"("run_id", "entity");

-- CreateIndex
CREATE UNIQUE INDEX "uq_etl_id_map_key" ON "etl_id_map"("legacy_source", "entity", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_etl_rejects_run_entity_reason" ON "etl_rejects"("run_id", "entity", "reason");

-- CreateIndex
CREATE UNIQUE INDEX "uq_etl_recon_run_entity" ON "etl_recon"("run_id", "entity");

-- AddForeignKey
ALTER TABLE "etl_checkpoints" ADD CONSTRAINT "etl_checkpoints_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "etl_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etl_rejects" ADD CONSTRAINT "etl_rejects_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "etl_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etl_recon" ADD CONSTRAINT "etl_recon_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "etl_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Enum-like columns are text + CHECK (plan 14.2, X2): no Postgres enum types.
ALTER TABLE "etl_runs" ADD CONSTRAINT "ck_etl_runs_mode" CHECK ("mode" IN ('dry-run', 'apply'));
ALTER TABLE "etl_runs" ADD CONSTRAINT "ck_etl_runs_status" CHECK ("status" IN ('running', 'succeeded', 'failed'));
ALTER TABLE "etl_runs" ADD CONSTRAINT "ck_etl_runs_sources" CHECK ("sources" <@ ARRAY['cloud', 'my']::TEXT[]);
ALTER TABLE "etl_id_map" ADD CONSTRAINT "ck_etl_id_map_source" CHECK ("legacy_source" IN ('cloud', 'my'));
ALTER TABLE "etl_rejects" ADD CONSTRAINT "ck_etl_rejects_reason"
  CHECK ("reason" IN ('UNKNOWN_ENUM', 'ORPHAN_PARENT', 'DUPLICATE_KEY', 'INVALID_VALUE', 'UNSUPPORTED'));
ALTER TABLE "etl_recon" ADD CONSTRAINT "ck_etl_recon_status" CHECK ("status" IN ('ok', 'mismatch'));
