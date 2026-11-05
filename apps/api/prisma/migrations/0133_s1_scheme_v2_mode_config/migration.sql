-- 0133_s1_scheme_v2_mode_config (S1-T09a part 2, DM-54 + DM-55)
-- DM-54: question_versions.scheme_rules jsonb null (question-level deductions and zeroIf of scheme v2; field names: 45 section 7.0).
-- DM-55: question_parts.mode_config jsonb null (per-part answer-mode settings: maxWords, wordRange, hardLimit, answerSpace, answerTemplate,
--        dependsOnPart, preFill, multi, grid, drawingKind, example, ...). The existing question_parts.drawing_kind column stays (issue #558 D1/D2).
-- Additive only: both columns are nullable with no default, no backfill and no rewrite of existing rows (D2). Scheme v1 rows are read as before.
-- Lock: ADD COLUMN with no default is a metadata change.
-- Rollback: forward-only in the migration runner. Manual revert (the columns hold nothing else depends on):
--   ALTER TABLE "question_parts" DROP COLUMN "mode_config";
--   ALTER TABLE "question_versions" DROP COLUMN "scheme_rules";

ALTER TABLE "question_versions" ADD COLUMN "scheme_rules" JSONB;
ALTER TABLE "question_parts" ADD COLUMN "mode_config" JSONB;

COMMENT ON COLUMN "question_versions"."scheme_rules" IS 'DM-54: scheme v2 question-level rules (deductions, zeroIf); NULL = none (scheme v1 rows).';
COMMENT ON COLUMN "question_parts"."mode_config" IS 'DM-55: per-part answer-mode settings (maxWords, wordRange, hardLimit, answerSpace, answerTemplate, dependsOnPart, preFill, multi, grid, drawingKind, example); NULL = defaults.';
