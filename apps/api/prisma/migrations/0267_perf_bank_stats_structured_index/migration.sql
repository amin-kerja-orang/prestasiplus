-- UAT perf (KP-18, fix the code, never the data): on the 457 thousand migrated V2 questions the planner statistics were out of date (the
-- V2 load wrote the structured questions and the PKSK tags AFTER the last ANALYZE: `question_versions.type` knew only 'mcq', `question_tags.kind`
-- only 'pool'), so it estimated one row where there were 1 700 to 750 and chose nested loops that took 8 to 40 s (structured list, bank counts).
--
--   1. a small partial index for the pupil structured list (approved, live type 'structured', by level);
--   2. fresh statistics now, and a lower auto-analyze threshold on the big bank tables, so a later bulk load is analysed within minutes
--      instead of after 10 percent of the rows have changed. No row is changed; ANALYZE only refreshes `pg_statistic`.
--
-- Reversible:
--   DROP INDEX IF EXISTS "ix_qv_structured_live_level";
--   ALTER TABLE "question_versions" RESET (autovacuum_analyze_scale_factor, autovacuum_analyze_threshold);  -- likewise for the other tables below

CREATE INDEX IF NOT EXISTS "ix_qv_structured_live_level" ON "question_versions" ("education_level_id", "question_id")
  WHERE "status" = 'approved' AND "type" = 'structured';

ALTER TABLE "question_versions" SET (autovacuum_analyze_scale_factor = 0.01, autovacuum_analyze_threshold = 500);
ALTER TABLE "questions" SET (autovacuum_analyze_scale_factor = 0.01, autovacuum_analyze_threshold = 500);
ALTER TABLE "question_tags" SET (autovacuum_analyze_scale_factor = 0.01, autovacuum_analyze_threshold = 200);
ALTER TABLE "question_parts" SET (autovacuum_analyze_scale_factor = 0.01, autovacuum_analyze_threshold = 500);
ALTER TABLE "answer_keys" SET (autovacuum_analyze_scale_factor = 0.01, autovacuum_analyze_threshold = 500);

ANALYZE "question_versions";
ANALYZE "questions";
ANALYZE "question_tags";
ANALYZE "question_parts";
ANALYZE "answer_keys";
ANALYZE "stimuli";
ANALYZE "question_version_stimuli";
ANALYZE "stimulus_group_stimuli";
