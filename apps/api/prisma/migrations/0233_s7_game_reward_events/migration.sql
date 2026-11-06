-- 0233_s7_game_reward_events (S7-T01), DM-87 (PO decision 2026-11-05, item 20).
--   One row per reward event of a finished game, per pupil. `game_session_id` is `game_rooms.session_id` or the solo session
--   uuid, so it has no foreign key. The unique index decides a replay. The row holds the first result: the XP and syiling
--   granted, and `capped_reason` when a daily cap of 48 section 3.4 rule 4 reduced them. The daily caps sum these rows.
--
-- Additive (expand only): a new empty table, no backfill.
-- Reversible:
--   DROP TABLE "game_reward_events";

-- DM-87
CREATE TABLE "game_reward_events" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "game_session_id" UUID NOT NULL,
    "user_id" BIGINT NOT NULL,
    "xp" INTEGER NOT NULL,
    "syiling" INTEGER NOT NULL,
    "capped_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_reward_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_game_reward_events_amounts" CHECK ("xp" >= 0 AND "syiling" >= 0),
    CONSTRAINT "ck_game_reward_events_capped_reason" CHECK ("capped_reason" IS NULL OR "capped_reason" IN ('xp_cap', 'syiling_cap', 'xp_and_syiling_cap'))
);

CREATE UNIQUE INDEX "uq_game_reward_events_game_session_id_user_id" ON "game_reward_events"("game_session_id", "user_id");
CREATE INDEX "ix_game_reward_events_user_id_created_at" ON "game_reward_events"("user_id", "created_at");

ALTER TABLE "game_reward_events" ADD CONSTRAINT "fk_game_reward_events_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
