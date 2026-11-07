
-- S6-T07 (DM-75, API-GUR-11): Misi Harian fields on missions. Expand-only: two new nullable columns and widened checks.
-- Existing rows keep their values; the pupil and practice readers are unchanged for them.
-- rollback: ALTER TABLE missions DROP CONSTRAINT ck_missions_reward_coins, DROP COLUMN reward_coins, DROP COLUMN description; delete the 'harian' rows first,
--   then restore ck_missions_mission_type and ck_missions_question_count.

ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "description" TEXT NULL;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "reward_coins" SMALLINT NULL;

ALTER TABLE "missions" DROP CONSTRAINT IF EXISTS "ck_missions_mission_type";
ALTER TABLE "missions" ADD CONSTRAINT "ck_missions_mission_type" CHECK ("mission_type" IN ('latih_tubi', 'tracking_a', 'youtube', 'harian'));

ALTER TABLE "missions" DROP CONSTRAINT IF EXISTS "ck_missions_question_count";
ALTER TABLE "missions" ADD CONSTRAINT "ck_missions_question_count" CHECK ("question_count" BETWEEN 1 AND 1000);

-- 0..100 for every row (mission_reward_max, D113-a); the API boundary enforces the same ceiling.
ALTER TABLE "missions" DROP CONSTRAINT IF EXISTS "ck_missions_reward_coins";
ALTER TABLE "missions" ADD CONSTRAINT "ck_missions_reward_coins" CHECK ("reward_coins" IS NULL OR ("reward_coins" >= 0 AND "reward_coins" <= 100));
