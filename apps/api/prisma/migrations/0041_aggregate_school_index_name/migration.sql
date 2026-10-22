-- AZ-22 (#61 m4): 0018_aggregate_school_id names its partial index
-- "ix_practice_attempt_aggregates_school_id_subject_code_submitted_at" (66 characters). PostgreSQL truncates
-- identifiers to 63 bytes (NAMEDATALEN - 1) with only a NOTICE, so the index really exists as
-- "ix_practice_attempt_aggregates_school_id_subject_code_submitted", a name no file spells. 0018 stays as it is
-- (applied migrations are never edited); this migration gives the index a name of at most 63 characters.
-- Rename only: same table, columns, order and predicate, no rebuild, no data change.
--
-- Reversible: ALTER INDEX "ix_practice_attempt_aggregates_school_subject_submitted"
--   RENAME TO "ix_practice_attempt_aggregates_school_id_subject_code_submitted";

ALTER INDEX "ix_practice_attempt_aggregates_school_id_subject_code_submitted" RENAME TO "ix_practice_attempt_aggregates_school_subject_submitted";
