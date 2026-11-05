-- 0236_s7_game_room_presence (S7-T01 part GAME-R, R3), DM-90, rulings 49 and 54.
--   `game_room_players.last_polled_at`: when the seat last polled or acted in a playing room (written at most every 5 s per
--   seat by the poll, and on every action). Null before the first. Presence = polled or acted within `games_absent_seconds`.
--   `game_room_players.consecutive_timeouts`: timeouts of the seat's own turns since its last action; 3 remove the seat.
--   A poll does not reset it, an action does. Both used to live in `game_rooms.state` (`seats[id].seenMs` / `missed`).
--
-- Additive (expand only): two columns, no backfill beyond the default; code that does not know them gets null and 0.
-- Idempotent: IF NOT EXISTS, so running the file twice changes nothing.
-- Reversible:
--   ALTER TABLE "game_room_players" DROP COLUMN IF EXISTS "consecutive_timeouts";
--   ALTER TABLE "game_room_players" DROP COLUMN IF EXISTS "last_polled_at";

ALTER TABLE "game_room_players" ADD COLUMN IF NOT EXISTS "last_polled_at" TIMESTAMPTZ(6);
ALTER TABLE "game_room_players" ADD COLUMN IF NOT EXISTS "consecutive_timeouts" INTEGER NOT NULL DEFAULT 0;
