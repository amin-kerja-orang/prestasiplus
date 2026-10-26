-- SW12-02: question-leading index on practice_answers for the teacher "Digunakan" (used) counter.
-- Additive only (one index, no data change).
--
-- Why: every index on practice_answers leads with user_id / session_id / subject_id (0014) or answered_at (0040), so
-- "which of these questions have at least one real answer" (TeacherQuestionStatsProvider.statsOf, behind
-- `GET /api/guru/contributions` and `GET /api/guru/dashboard`) had to scan the whole answer log on every call; with the
-- migrated .cloud history that table is large. A partial index on (question_id) WHERE question_id IS NOT NULL AND NOT is_test
-- matches the predicate of that read exactly (migrated historical rows have no question link, test traffic is not usage),
-- so it stays small and the read becomes one index probe per owned question.
--
-- Hand-written, like 0018 and 0040: Prisma cannot express a partial index, and declaring it as @@index would make the next
-- `prisma migrate dev` drop the WHERE clause, so schema.prisma is not changed.
-- The name is 36 characters (PostgreSQL truncates identifiers longer than 63 bytes, see 0041).
--
-- Reversible: DROP INDEX "ix_practice_answers_question_id_real";

CREATE INDEX "ix_practice_answers_question_id_real" ON "practice_answers"("question_id") WHERE "question_id" IS NOT NULL AND NOT "is_test";
