-- 0223_s7_reward_settings (S7-T05, DM-48): the singleton `reward_settings`, the one source of the coin rate (D-A11, F-12).
-- Four values move here from `gamification_settings` (OD-19; names per DM-48):
--   flat_quiz_reward          -> coins_per_correct      default 1,     range 0..20
--   reward_budget_sen_session -> redeem_budget_sen      default 300,   range 0..100000
--   current_session_year      -> session_year           default 2026,  range 2020..2100
--   games_award_syiling       -> mini_games_give_coins  default false, 1 = true
-- The row always exists after this file. A key with no row, or a value outside its range of 48 section 2 (rounded first), takes the default.
--
-- Additive (expand only): the source rows stay in `gamification_settings` and its check `ck_gamification_settings_key` is not touched (S7-T01).
-- Reversible: DROP TABLE "reward_settings";

-- CreateTable
CREATE TABLE "reward_settings" (
    "id" SMALLINT NOT NULL DEFAULT 1,
    "coins_per_correct" SMALLINT NOT NULL DEFAULT 1,
    "redeem_budget_sen" INTEGER NOT NULL DEFAULT 300,
    "session_year" SMALLINT NOT NULL,
    "mini_games_give_coins" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" BIGINT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_reward_settings_singleton" CHECK ("id" = 1),
    CONSTRAINT "ck_reward_settings_coins_per_correct" CHECK ("coins_per_correct" BETWEEN 0 AND 20)
);

-- AddForeignKey
ALTER TABLE "reward_settings" ADD CONSTRAINT "fk_reward_settings_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Copy the four values
INSERT INTO "reward_settings" ("id", "coins_per_correct", "redeem_budget_sen", "session_year", "mini_games_give_coins")
SELECT
    1,
    COALESCE((SELECT round("value")::smallint FROM "gamification_settings" WHERE "key" = 'flat_quiz_reward' AND round("value") BETWEEN 0 AND 20), 1),
    COALESCE((SELECT round("value")::integer FROM "gamification_settings" WHERE "key" = 'reward_budget_sen_session' AND round("value") BETWEEN 0 AND 100000), 300),
    COALESCE((SELECT round("value")::smallint FROM "gamification_settings" WHERE "key" = 'current_session_year' AND round("value") BETWEEN 2020 AND 2100), 2026),
    COALESCE((SELECT "value" = 1 FROM "gamification_settings" WHERE "key" = 'games_award_syiling'), false);
