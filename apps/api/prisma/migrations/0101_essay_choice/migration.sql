-- 0101_essay_choice (R1-T25, ADR-0030/0031, v2-admin-student-pipeline section 2): the `essay_choice` leaf in the one question bank.
-- Number 0101 is in team A's range 0100-0109 (0100 is the lifecycle migration of a parallel lane; this file does not read or
-- depend on any status value).
--
-- V2 (prestasiplus.cloud) has 39 `essay_choice` parts, 31 on approved questions: the pupil picks one of 2 to 6 topics, then writes
-- one essay marked by a rubric or a points key (docs/discovery/cloud-student-mechanism.md section 1.4).
--
--   question_parts.mode    += 'essay_choice'
--   question_parts.topics   jsonb  [{ "id": "<free string>", "label": "<text>" }, ...] (2..6), only on an essay_choice leaf
--
-- The word range reuses the existing word_min / word_max columns (as `essay`). The answer key is the existing `rubric` or `points`
-- kind (answer_keys), so answer_keys.kind is not touched. ADDITIVE ONLY: one nullable column and one widened CHECK; every existing row
-- satisfies both (topics is NULL and no row has the new mode).
--
-- Reversible (after deleting essay_choice parts):
--   ALTER TABLE "question_parts" DROP CONSTRAINT "ck_question_parts_topics";
--   ALTER TABLE "question_parts" DROP COLUMN "topics";
--   ALTER TABLE "question_parts" DROP CONSTRAINT "ck_question_parts_mode";
--   ALTER TABLE "question_parts" ADD CONSTRAINT "ck_question_parts_mode" CHECK ("mode" IS NULL OR "mode" IN ('mcq', 'match_letter', 'short_text', 'numeric', 'working', 'essay', 'drawing', 'table_fill', 'pksk_choice'));

ALTER TABLE "question_parts" ADD COLUMN "topics" JSONB;

ALTER TABLE "question_parts" DROP CONSTRAINT "ck_question_parts_mode";
ALTER TABLE "question_parts" ADD CONSTRAINT "ck_question_parts_mode"
  CHECK ("mode" IS NULL OR "mode" IN ('mcq', 'match_letter', 'short_text', 'numeric', 'working', 'essay', 'drawing', 'table_fill', 'pksk_choice', 'essay_choice'));

-- An essay_choice leaf has 2 to 6 topics; no other part has any.
ALTER TABLE "question_parts" ADD CONSTRAINT "ck_question_parts_topics"
  CHECK (
    ("mode" IS DISTINCT FROM 'essay_choice' AND "topics" IS NULL)
    OR ("mode" = 'essay_choice' AND "topics" IS NOT NULL AND jsonb_typeof("topics") = 'array' AND jsonb_array_length("topics") BETWEEN 2 AND 6)
  );
