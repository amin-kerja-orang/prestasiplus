-- S5-T15, DM-66: a practice session idle for 2 hours becomes 'abandoned' (UI word "ditinggalkan").
-- ck_practice_sessions_completed_at needs no change: an abandoned session has no completed_at.
ALTER TABLE "practice_sessions" DROP CONSTRAINT "ck_practice_sessions_status";
ALTER TABLE "practice_sessions" ADD CONSTRAINT "ck_practice_sessions_status" CHECK ("status" IN ('in_progress', 'completed', 'abandoned'));

-- DM-66: the sweeper scans in-progress sessions by age; this partial index keeps that scan small.
CREATE INDEX "ix_practice_sessions_in_progress_started_at" ON "practice_sessions" ("started_at") WHERE "status" = 'in_progress';
