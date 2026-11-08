-- 0235_s7_game_sessions_due_index (S7-T01, DM-89, FR-GM-00.7): partial index for the server-clock sweep of Jutawan runs.
-- The 5 s sweep (JutawanRepository.dueRuns) reads only the runs still open, ordered and bounded by created_at:
--   game = 'jutawan' AND NOT jutawan_over AND submitted_at IS NULL AND closed_at IS NULL AND created_at <= :before ORDER BY created_at
-- The index holds exactly those rows, so the sweep never reads the finished sessions of the other games. The WHERE clause
-- below must stay equal to that predicate, or the planner cannot use the index.
-- Additive, no backfill, no table rewrite. Plain CREATE INDEX (migrations run in a transaction, so not CONCURRENTLY).
-- Reversible: DROP INDEX "ix_game_sessions_jutawan_due";

-- CreateIndex (partial: Prisma cannot express it, so it lives here only)
CREATE INDEX "ix_game_sessions_jutawan_due" ON "game_sessions"("created_at") WHERE "game" = 'jutawan' AND NOT "jutawan_over" AND "submitted_at" IS NULL AND "closed_at" IS NULL;
