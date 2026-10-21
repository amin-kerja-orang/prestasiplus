-- AZ-22 (#61 m4): 0018 created its partial index with a 66-character name, which Postgres truncated to the
-- 63-character identifier limit (NAMEDATALEN - 1) with a NOTICE, so the stored name differs from the one in the SQL.
-- 0018 is never edited; this migration renames the index to a name under the limit. Rename only: the definition
-- (school_id, subject_code, submitted_at DESC) WHERE NOT is_test and its data are unchanged, nothing is rebuilt.
-- The old name is written in its stored (truncated) form, so this statement raises no NOTICE.
-- IF EXISTS: a database where the index is already gone or renamed is left as it is.
--
-- Reversible: ALTER INDEX "ix_practice_attempt_aggregates_school_subject_submitted"
--   RENAME TO "ix_practice_attempt_aggregates_school_id_subject_code_submitted";

ALTER INDEX IF EXISTS "ix_practice_attempt_aggregates_school_id_subject_code_submitted" RENAME TO "ix_practice_attempt_aggregates_school_subject_submitted";
