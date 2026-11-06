-- 0134_s1_question_types (S1-T09a part 2, DM-69, issue #558 D4)
-- Widens ck_question_versions_type (migration 0011) from (mcq, match, short, structured, working, essay, drawing, table) by ADDING
-- mcq_multi, true_false and fill_blank. Stored values stay `short` and `table` (D4: the contract names short_answer/table_fill; the mapping is in the application).
-- ck_answer_keys_kind is NOT touched: it already allows `options` (D3). Additive: every existing row stays valid, no backfill.
-- Pattern of 0131: add the new check NOT VALID under a temporary name, VALIDATE, drop the old one, rename (same final name).
-- Rollback (manual; rows with the three new types must be removed or recoded first):
--   ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_type_old"
--     CHECK ("type" IN ('mcq', 'match', 'short', 'structured', 'working', 'essay', 'drawing', 'table')) NOT VALID;
--   ALTER TABLE "question_versions" VALIDATE CONSTRAINT "ck_question_versions_type_old";
--   ALTER TABLE "question_versions" DROP CONSTRAINT "ck_question_versions_type";
--   ALTER TABLE "question_versions" RENAME CONSTRAINT "ck_question_versions_type_old" TO "ck_question_versions_type";

ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_type_new"
  CHECK ("type" IN ('mcq', 'match', 'short', 'structured', 'working', 'essay', 'drawing', 'table', 'mcq_multi', 'true_false', 'fill_blank')) NOT VALID;
ALTER TABLE "question_versions" VALIDATE CONSTRAINT "ck_question_versions_type_new";
ALTER TABLE "question_versions" DROP CONSTRAINT "ck_question_versions_type";
ALTER TABLE "question_versions" RENAME CONSTRAINT "ck_question_versions_type_new" TO "ck_question_versions_type";
