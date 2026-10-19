/**
 * Materialised M15 tables (SRS M15 v1.4 §6.8: small stores, every count is a query over the rows).
 *
 * - `rewards`: ids 1–59 seeded; a new reward gets the highest id ever issued + 1 (deleted ids are
 *   never reused, BR-M15-14), which is the `maxPlusOne` strategy.
 * - `redemptions`, `openings`: seeded / fixture ids stay below 9,000,001; runtime ids start there
 *   (BR-M15-14, `floor`).
 */

import { defineTable, floor, maxPlusOne, ID_RANGES } from '@/mock/define'

import type { HadiahRedemption, HadiahReward, MysteryBoxOpening } from './types'

export const rewardsTable = defineTable<HadiahReward>({
  name: 'hadiah.rewards',
  ids: maxPlusOne(),
  indexes: ['category'],
})

export const redemptionsTable = defineTable<HadiahRedemption>({
  name: 'hadiah.redemptions',
  ids: floor({ start: ID_RANGES.usersRuntimeFloor }),
  indexes: ['userId', 'rewardId', 'status'],
})

export const openingsTable = defineTable<MysteryBoxOpening>({
  name: 'hadiah.mysteryBoxOpenings',
  ids: floor({ start: ID_RANGES.usersRuntimeFloor }),
  indexes: ['userId'],
})

export const M15_TABLES = {
  rewards: rewardsTable,
  redemptions: redemptionsTable,
  openings: openingsTable,
}
