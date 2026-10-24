-- QLOAD (draw-path performance): three partial covering indexes on question_versions for the learner draws and counts.
-- Additive only (three indexes, no data change).
--
-- Why: the legacy MCQ load puts hundreds of thousands of published versions in the bank. The only index on live
-- versions is ix_question_versions_published_subject_level (0011: subject_id, education_level_id WHERE published), which
-- cannot serve a chapter filter, a level-only filter or a difficulty filter, and has no covering columns, so every draw,
-- count and group-by walks the heap of question_versions.
--   ix_qv_pub_subject_level_tp : (subject, level, difficulty_tp) INCLUDE (question_id, type, chapter_id)
--     practice random / latih tubi / pool counts, Jutawan, games with a subject, bankMatrix, hub counts.
--   ix_qv_pub_chapter          : (chapter_id) INCLUDE (question_id, type)
--     chapter counts and draws (practice chapter mode, dashboard chapter list, missions, reports "available questions").
--     question_versions.chapter_id is a foreign key and had no index at all.
--   ix_qv_pub_level_tp         : (education_level_id, difficulty_tp) INCLUDE (question_id, type)
--     level-only filters (solo games, Kad Memori, room pool fallbacks) and groupCount('level').
-- The predicate WHERE status = 'published' matches the live-version scope of QuestionsRepository (a published version is
-- the live one: uq_question_versions_one_published).
--
-- Hand-written, like the partial indexes in 0011 and 0040: Prisma cannot express a partial or covering index, so the
-- schema carries no @@index for these (declaring one would make the next `prisma migrate dev` drop the WHERE clause).
-- Plain CREATE INDEX (not CONCURRENTLY): migrations run in a transaction and this ships before go-live.
--
-- Reversible:
--   DROP INDEX "ix_qv_pub_level_tp";
--   DROP INDEX "ix_qv_pub_chapter";
--   DROP INDEX "ix_qv_pub_subject_level_tp";

CREATE INDEX "ix_qv_pub_subject_level_tp" ON "question_versions" ("subject_id", "education_level_id", "difficulty_tp")
  INCLUDE ("question_id", "type", "chapter_id") WHERE "status" = 'published';

CREATE INDEX "ix_qv_pub_chapter" ON "question_versions" ("chapter_id")
  INCLUDE ("question_id", "type") WHERE "status" = 'published';

CREATE INDEX "ix_qv_pub_level_tp" ON "question_versions" ("education_level_id", "difficulty_tp")
  INCLUDE ("question_id", "type") WHERE "status" = 'published';
