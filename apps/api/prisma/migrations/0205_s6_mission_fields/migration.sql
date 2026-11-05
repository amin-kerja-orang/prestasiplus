-- S6-T07 (DM-75, API-GUR-11): Misi Harian fields on missions. Expand-only: new nullable columns, a widened check, and
-- teacher_id/subject_id become nullable so a Global (platform) mission can exist without an owner or a subject.
-- Existing rows keep their values (scope defaults to 'teacher'); the pupil and practice readers are unchanged for them.
-- goal_kind (PO decision on #483): a Global mission is an achievement goal measured from the pupil's practice activity; its kind is stored here.
-- rollback: DROP INDEX uq_missions_global_title; ALTER TABLE missions DROP CONSTRAINT ck_missions_goal_kind, DROP CONSTRAINT ck_missions_goal_kind_scope, DROP COLUMN goal_kind; ALTER TABLE missions DROP CONSTRAINT ck_missions_owner_scope,
--   DROP CONSTRAINT ck_missions_reward_coins_teacher, DROP COLUMN scope, DROP COLUMN reward_coins, DROP COLUMN description; delete the 'harian' rows and global rows first,
--   then ALTER COLUMN teacher_id/subject_id SET NOT NULL and restore ck_missions_mission_type and ck_missions_question_count.

ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "description" TEXT NULL;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "reward_coins" SMALLINT NULL;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'teacher';
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "goal_kind" TEXT NULL;

ALTER TABLE "missions" ALTER COLUMN "teacher_id" DROP NOT NULL;
ALTER TABLE "missions" ALTER COLUMN "subject_id" DROP NOT NULL;

ALTER TABLE "missions" DROP CONSTRAINT IF EXISTS "ck_missions_mission_type";
ALTER TABLE "missions" ADD CONSTRAINT "ck_missions_mission_type" CHECK ("mission_type" IN ('latih_tubi', 'tracking_a', 'youtube', 'harian'));

ALTER TABLE "missions" DROP CONSTRAINT IF EXISTS "ck_missions_question_count";
ALTER TABLE "missions" ADD CONSTRAINT "ck_missions_question_count" CHECK ("question_count" BETWEEN 1 AND 1000);

ALTER TABLE "missions" DROP CONSTRAINT IF EXISTS "ck_missions_reward_coins";
ALTER TABLE "missions" ADD CONSTRAINT "ck_missions_reward_coins" CHECK ("reward_coins" IS NULL OR "reward_coins" >= 0);
-- The 0..100 ceiling (mission_reward_max, D113-a) is a rule for what a teacher may create, enforced at the API boundary and here
-- for teacher rows. A Global row may exceed it: the observed platform mission "Kombo 10" pays +120 (PRD 20 R1-GUR-2b), and seeds
-- mirror observation. Do not tighten this to all rows without changing that seed value (recorded as a deviation on the card).
ALTER TABLE "missions" DROP CONSTRAINT IF EXISTS "ck_missions_reward_coins_teacher";
ALTER TABLE "missions" ADD CONSTRAINT "ck_missions_reward_coins_teacher" CHECK ("scope" = 'global' OR "reward_coins" IS NULL OR "reward_coins" <= 100);

ALTER TABLE "missions" DROP CONSTRAINT IF EXISTS "ck_missions_scope";
ALTER TABLE "missions" ADD CONSTRAINT "ck_missions_scope" CHECK ("scope" IN ('teacher', 'global'));

ALTER TABLE "missions" DROP CONSTRAINT IF EXISTS "ck_missions_owner_scope";
ALTER TABLE "missions" ADD CONSTRAINT "ck_missions_owner_scope" CHECK ("scope" = 'global' OR ("teacher_id" IS NOT NULL AND "subject_id" IS NOT NULL));

-- goal_kind: one of the seven kinds (the contract's MISSION_GOAL_KINDS); a Global mission has one, a teacher mission has none.
-- A Global row written by an earlier run of this migration (seed only, no goal yet, no reward table yet) is removed first; the seed restores it.
DELETE FROM "missions" WHERE "scope" = 'global' AND "goal_kind" IS NULL;
ALTER TABLE "missions" DROP CONSTRAINT IF EXISTS "ck_missions_goal_kind";
ALTER TABLE "missions" ADD CONSTRAINT "ck_missions_goal_kind" CHECK ("goal_kind" IS NULL OR "goal_kind" IN ('sessions_per_day', 'correct_per_day', 'correct_in_session', 'accuracy_in_session', 'minutes_per_day', 'topics_per_day', 'streak_days'));
ALTER TABLE "missions" DROP CONSTRAINT IF EXISTS "ck_missions_goal_kind_scope";
ALTER TABLE "missions" ADD CONSTRAINT "ck_missions_goal_kind_scope" CHECK (("scope" = 'global' AND "goal_kind" IS NOT NULL) OR ("scope" = 'teacher' AND "goal_kind" IS NULL));

-- One Global mission per title: the idempotent seed upserts on it.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_missions_global_title" ON "missions"("title") WHERE "scope" = 'global';
