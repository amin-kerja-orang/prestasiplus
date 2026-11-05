-- 0229_s7_reward_catalogue_merge (S7-T05, DM-77): the columns of the one reward catalogue. Columns only: the product owner deferred the
-- merge (#501, 2026-11-05), so no row is created or moved from `syiling_rewards` or `reward_claims`, and neither table is dropped. The dry
-- run of the merge is `scripts/ops/reward-catalogue-dry-run.mjs`.
--   rewards.cost_value_sen                     real cost in sen; 0 = a digital gift, which never uses the session budget (48 GAME-21)
--   reward_redemptions.token_cost_snapshot     the reward's `token_cost` at the time of redemption
--   reward_redemptions.cost_value_sen_snapshot the reward's `cost_value_sen` at the time of redemption; the session budget sums it
-- Existing redemptions: token_cost_snapshot = their stored `token_cost`; cost_value_sen_snapshot = 0, so they use no budget.
-- Additive (expand only). Reversible: DROP COLUMN the three columns.

-- AlterTable
ALTER TABLE "rewards" ADD COLUMN "cost_value_sen" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: the default keeps the old app able to insert during the deploy window (expand-then-contract). The new code always writes both.
ALTER TABLE "reward_redemptions" ADD COLUMN "token_cost_snapshot" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "cost_value_sen_snapshot" INTEGER NOT NULL DEFAULT 0;
UPDATE "reward_redemptions" SET "token_cost_snapshot" = "token_cost";
