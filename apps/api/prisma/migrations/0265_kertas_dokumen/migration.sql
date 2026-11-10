-- 0265_kertas_dokumen (V2 parity, Kertas Subjektif page-image documents). V2 `paper_documents` (254) and `paper_document_pages` (7,424 page images)
-- ARE the V2 Kertas Subjektif feature: a subjective past paper (Kertas 2/3/4) served as page images plus a revealable marking scheme.
-- V3 keeps its question-based Kertas Subjektif papers (`papers.surface = 'subjektif'`) and adds these two tables beside them; both appear in
-- the one admin list and the one pupil list. Nothing here is a question store (no marking, no DSKP tags).
--  - `paper_documents.published_at` NULL = Draf; the pupil reads published rows only (the serving whitelist is absolute, as in V2).
--  - `paper_document_pages.file_id` -> `files` (purpose `kertas_page`); the bytes are never a path from the client.
--  - Both tables carry `legacy_source` / `legacy_id` (unique pair) so the V2 load is idempotent.
-- Additive: two new tables, no existing row changes.
-- Reversible: DROP TABLE "paper_document_pages"; DROP TABLE "paper_documents";

-- CreateTable
CREATE TABLE "paper_documents" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "subject_id" BIGINT,
    "kertas" SMALLINT NOT NULL,
    "title" TEXT NOT NULL,
    "negeri" TEXT,
    "year" SMALLINT,
    "source_file" TEXT,
    "duration_minutes" SMALLINT,
    "marks_total" SMALLINT,
    "page_count" SMALLINT NOT NULL DEFAULT 0,
    "scheme_page_count" SMALLINT NOT NULL DEFAULT 0,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "paper_documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_paper_documents_kertas" CHECK ("kertas" IN (2, 3, 4)),
    CONSTRAINT "ck_paper_documents_counts" CHECK ("page_count" >= 0 AND "scheme_page_count" >= 0),
    CONSTRAINT "ck_paper_documents_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'))
);

-- CreateTable
CREATE TABLE "paper_document_pages" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "paper_document_id" BIGINT NOT NULL,
    "kind" TEXT NOT NULL,
    "position" SMALLINT NOT NULL,
    "file_id" BIGINT NOT NULL,
    "width" SMALLINT,
    "height" SMALLINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "paper_document_pages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_paper_document_pages_kind" CHECK ("kind" IN ('paper', 'scheme')),
    CONSTRAINT "ck_paper_document_pages_position" CHECK ("position" >= 1),
    CONSTRAINT "ck_paper_document_pages_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'))
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_paper_documents_legacy" ON "paper_documents"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_paper_documents_subject_kertas" ON "paper_documents"("subject_id", "kertas");

-- CreateIndex
CREATE INDEX "ix_paper_documents_published_at" ON "paper_documents"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_paper_document_pages_slot" ON "paper_document_pages"("paper_document_id", "kind", "position");

-- CreateIndex
CREATE UNIQUE INDEX "uq_paper_document_pages_legacy" ON "paper_document_pages"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_paper_document_pages_file_id" ON "paper_document_pages"("file_id");

-- AddForeignKey
ALTER TABLE "paper_documents" ADD CONSTRAINT "fk_paper_documents_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_document_pages" ADD CONSTRAINT "fk_paper_document_pages_document_id" FOREIGN KEY ("paper_document_id") REFERENCES "paper_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_document_pages" ADD CONSTRAINT "fk_paper_document_pages_file_id" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
