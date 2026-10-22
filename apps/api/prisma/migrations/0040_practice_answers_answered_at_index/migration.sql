-- AZ-13 (issue #70): time-leading index on practice_answers for the Command Center platform reads.
-- Additive only (one index, no data change).
--
-- Why: every index on practice_answers leads with user_id / session_id / subject_id (0014), so the platform reads
-- (newest-answers feed, "today" and week windows) scan the whole log. A partial index on (answered_at DESC, id DESC)
-- WHERE NOT is_test serves exactly the read shape of CommandCenterRepository.latestAnswers
-- (`WHERE is_test = false ... ORDER BY answered_at DESC, id DESC LIMIT n`) and the time-window range scans.
-- Measured on 100k generated answers / 3,000 students / 50 schools: platform feed 73 -> 0.7 ms, daily "today"
-- 45 -> 13 ms, top students this week 73 -> 26 ms (see docs/architecture/v2-backend-deviations.md, AZ-13).
-- Not covering (no INCLUDE): the INCLUDE (user_id, is_correct) variant tried in #70 was no faster.
--
-- Hand-written, like the partial index in 0018: Prisma cannot express a partial index, so schema.prisma carries only
-- a comment on the model (declaring it as @@index would make the next `prisma migrate dev` drop the WHERE clause).
-- School-scoped feed reads are kept off this index in the application (an ORDER BY expression, see
-- CommandCenterRepository.latestAnswers): the planner cannot see that a small school's answers are old and would
-- otherwise walk the whole index (1 -> 100 ms for a small school).
--
-- Reversible: DROP INDEX "ix_practice_answers_answered_at_id";

CREATE INDEX "ix_practice_answers_answered_at_id" ON "practice_answers"("answered_at" DESC, "id" DESC) WHERE NOT "is_test";
