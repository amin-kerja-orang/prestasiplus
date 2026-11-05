-- 0234_s7_achievement_juara_battle (S7-T04, DM-38, ruling 22, GAME-25): badge #26 "Juara Battle" and the criterion kind `battle_wins`.
-- Idempotent data migration (the M-9 exception, plan:298), shipped with the check change it completes:
--   1. re-create ck_achievements_criterion_kind with the 14 kinds of 0019 plus `battle_wins`;
--   2. a legacy row named "Juara Battle" (ETL, null criterion) gets the structured criterion; a row that already has one is left alone;
--   3. with no row of that name, the row is inserted, but only on a database that already has achievements (real or ETL data).
--      A fresh migrated database has none: there #26 comes from the seed (ACHIEVEMENT_ROWS, last, id 26), so ids stay in catalogue order.
-- Badge evaluation of `battle_wins` is S7-T04 part 16, not here (an unknown kind evaluates to 0 until then, so nothing unlocks early).
-- Reversible: UPDATE the row back to NULL criterion (or DELETE it if inserted here), then re-create the check without 'battle_wins'.

ALTER TABLE "achievements" DROP CONSTRAINT IF EXISTS "ck_achievements_criterion_kind";
ALTER TABLE "achievements" ADD CONSTRAINT "ck_achievements_criterion_kind" CHECK ("criterion_kind" IS NULL OR "criterion_kind" IN (
    'practice_sessions', 'streak', 'lifetime_syiling', 'accurate_sessions', 'subjects', 'mystery_openings', 'completions',
    'math_correct', 'science_correct', 'fast_answers', 'referrals', 'unlocked', 'answers_accuracy', 'perfect_days', 'battle_wins'));

UPDATE "achievements"
   SET "criterion_kind" = 'battle_wins', "criterion_min" = 10, "rarity" = 'rare', "reward_syiling" = 30, "reward_xp" = 20, "updated_at" = CURRENT_TIMESTAMP
 WHERE lower(btrim("name")) = 'juara battle' AND "criterion_kind" IS NULL;

INSERT INTO "achievements" ("name", "description", "icon", "rarity", "reward_syiling", "reward_xp", "criterion_kind", "criterion_min")
SELECT 'Juara Battle', 'Menang 10 battle', '⚔️', 'rare', 30, 20, 'battle_wins', 10
 WHERE EXISTS (SELECT 1 FROM "achievements")
   AND NOT EXISTS (SELECT 1 FROM "achievements" WHERE lower(btrim("name")) = 'juara battle');
