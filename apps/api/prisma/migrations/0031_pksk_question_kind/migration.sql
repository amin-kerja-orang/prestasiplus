-- 0031_pksk_question_kind (BE-42, LEAD decision 2026-10-21): the PKSK choice leaf in the one question bank (D12).
-- Number 0031 allocated by the LEAD. ADDITIVE ONLY: two CHECK constraints are widened by one value each; no row, column,
-- table or index is touched, and every existing row still satisfies the wider check.
--
--   question_parts.mode  += 'pksk_choice'  (0 or 2 to 6 options, any number of correct labels; contract QuestionLeafPart)
--   answer_keys.kind     += 'options'      ({ kind: 'options', correct: ['A', ...] }; the only kind that holds 0..n correct labels)
--
-- The leaf is valid only on a question tagged `pksk_domain` (question_tags, migration 0011): the question service refuses it
-- (422) on every other path. Curriculum columns of the version stay null for a PKSK question.
--
-- Reversible (after deleting PKSK questions): restore the two checks of 0011_question_bank without the new value:
--   ALTER TABLE "question_parts" DROP CONSTRAINT "ck_question_parts_mode";
--   ALTER TABLE "question_parts" ADD CONSTRAINT "ck_question_parts_mode" CHECK ("mode" IS NULL OR "mode" IN ('mcq', 'match_letter', 'short_text', 'numeric', 'working', 'essay', 'drawing', 'table_fill'));
--   ALTER TABLE "answer_keys" DROP CONSTRAINT "ck_answer_keys_kind";
--   ALTER TABLE "answer_keys" ADD CONSTRAINT "ck_answer_keys_kind" CHECK ("kind" IN ('option', 'accepted', 'mapping', 'points', 'rubric'));

ALTER TABLE "question_parts" DROP CONSTRAINT "ck_question_parts_mode";
ALTER TABLE "question_parts" ADD CONSTRAINT "ck_question_parts_mode"
  CHECK ("mode" IS NULL OR "mode" IN ('mcq', 'match_letter', 'short_text', 'numeric', 'working', 'essay', 'drawing', 'table_fill', 'pksk_choice'));

ALTER TABLE "answer_keys" DROP CONSTRAINT "ck_answer_keys_kind";
ALTER TABLE "answer_keys" ADD CONSTRAINT "ck_answer_keys_kind" CHECK ("kind" IN ('option', 'accepted', 'mapping', 'points', 'rubric', 'options'));
