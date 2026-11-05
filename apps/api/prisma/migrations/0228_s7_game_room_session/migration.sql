-- 0228_s7_game_room_session (S7-T01 part 2), DM-67.
--   `game_rooms.session_id`: the `attempt_id` of room answer rows, a new value each time a room starts (`waiting` to
--   `playing`), because a room code has 6 characters and can be reused. Existing rooms get a generated value.
--   `game_room_players.user_id` becomes nullable: a robot seat has no user (ruling 6 on #497, 48 GAME-R, AC-GM-00.4).
--   Postgres treats NULLs as distinct, so `uq_game_room_players_room_code_user_id` allows several robot seats.
--
-- Additive (expand only): nothing is removed, and code that does not know the column gets the default.
-- Reversible, in this order (assumes no robot seat needs keeping):
--   DELETE FROM "game_room_players" WHERE "user_id" IS NULL;
--   ALTER TABLE "game_room_players" ALTER COLUMN "user_id" SET NOT NULL;
--   DROP INDEX "uq_game_rooms_session_id";
--   ALTER TABLE "game_rooms" DROP COLUMN "session_id";

ALTER TABLE "game_rooms" ADD COLUMN "session_id" UUID NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "uq_game_rooms_session_id" ON "game_rooms"("session_id");

ALTER TABLE "game_room_players" ALTER COLUMN "user_id" DROP NOT NULL;
