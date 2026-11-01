-- R1 perf (T54 report F3): trigram indexes for the admin question list text search.
-- Additive only (one extension, two partial indexes, no data change).
--
-- Why: `GET /api/questions?search=...` filters `v.stem_ms ILIKE '%x%' ESCAPE '\' OR v.stem_en ILIKE '%x%' ESCAPE '\'`. A btree cannot serve a
-- contains search, so on a 408k-question bank Postgres read every row of question_versions (EXPLAIN: Seq Scan, 1.8 s; with the trigram
-- indexes: BitmapOr of two GIN scans, 21 ms). The status counts and the total of the same list use the same filter, so they benefit too.
-- Search terms of fewer than 3 characters still scan (a trigram needs 3).
--
-- `pg_trgm` is a contrib module and a TRUSTED extension (Postgres 13+): the database owner can create it; on a managed host it must be
-- allowed (Supabase: enabled by default; Render/RDS: allowed). If CREATE EXTENSION is refused the deploy stops here, nothing else changed.
--
-- The indexes are partial (WHERE column IS NOT NULL): ILIKE is strict, so the planner proves the predicate from the query and rows without
-- an English stem take no index space. Plain CREATE INDEX, not CONCURRENTLY: Prisma runs this multi-statement file in one transaction
-- (CONCURRENTLY would fail), as 0011 and 0044 did. The build takes about 18 s on 400k rows and blocks writes to question_versions for that
-- time: deploy in the maintenance window (the same window as 0100).
--
-- Reversible:
--   DROP INDEX "ix_question_versions_stem_en_trgm";
--   DROP INDEX "ix_question_versions_stem_ms_trgm";
--   DROP EXTENSION "pg_trgm";   -- only if nothing else uses it (check \dx and the indexes that mention gin_trgm_ops first)

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "ix_question_versions_stem_ms_trgm" ON "question_versions" USING gin ("stem_ms" gin_trgm_ops) WHERE "stem_ms" IS NOT NULL;
CREATE INDEX "ix_question_versions_stem_en_trgm" ON "question_versions" USING gin ("stem_en" gin_trgm_ops) WHERE "stem_en" IS NOT NULL;
