import { z } from '../zod'
import { int } from './shared'

/**
 * S7-T05, DM-48, API-ADM-16: the four `reward_settings` values under their API-ADM-16 names, with
 * the ranges of 48 section 2. They sit beside the older names of `GamificationEconomySettingsSchema`;
 * no name is removed in R1.
 */
export const RewardSettingsSchema = z.object({
  redeemBudget: int.min(0).max(100000).meta({ description: 'The one global session budget, in sen (`redeem_budget_sen`).' }),
  flatCoins: int.min(0).max(20).meta({ description: 'Syiling per correct answer (`coins_per_correct`).' }),
  sessionYear: int.min(2020).max(2100).meta({ description: 'The current session year (`session_year`).' }),
  miniGamesCoins: z.boolean().meta({ description: 'Whether games pay Syiling (`mini_games_give_coins`).' }),
})
export type RewardSettings = z.infer<typeof RewardSettingsSchema>
