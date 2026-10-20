-- 0005_files (BE-04): the `files` table behind FileStorage.
-- `id` is internal (other tables reference it); the API only shows `public_id`, a random 128-bit base64url token.
-- Hand-edited after Prisma: identity column, CHECK constraints (text + check), legacy check.
-- Number 0004 belongs to BE-05 (allocated by the lead); the gap is intended.

-- CreateTable
CREATE TABLE "files" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "public_id" TEXT NOT NULL,
    "owner_user_id" BIGINT,
    "purpose" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_files_public_id" CHECK ("public_id" ~ '^[A-Za-z0-9_-]{22}$'),
    CONSTRAINT "ck_files_purpose" CHECK ("purpose" ~ '^[a-z][a-z0-9_]{1,39}$'),
    CONSTRAINT "ck_files_mime" CHECK ("mime" IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
    CONSTRAINT "ck_files_size_bytes" CHECK ("size_bytes" > 0),
    CONSTRAINT "ck_files_sha256" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "ck_files_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'))
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_files_public_id" ON "files"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_files_storage_key" ON "files"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_files_legacy" ON "files"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_files_owner_user_id_purpose" ON "files"("owner_user_id", "purpose");

-- CreateIndex
CREATE INDEX "ix_files_sha256" ON "files"("sha256");

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "fk_files_owner_user_id" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
