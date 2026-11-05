import { Inject, Injectable } from '@nestjs/common'
import { GAMIFICATION_MESSAGES as MSG } from '@pp/contract'

import type { PrismaClient, TxClient } from '../../db/client'
import { idFromString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'

/** The singleton `reward_settings` row (DM-48), the one source of the coin rate (D-A11, F-12). */
export interface RewardSettingsValues {
  coinsPerCorrect: number
  redeemBudgetSen: number
  sessionYear: number
  miniGamesGiveCoins: boolean
}

/** The DM-48 defaults. Migration 0223 always leaves the row; these only answer if it was removed by hand. */
const DEFAULTS: RewardSettingsValues = { coinsPerCorrect: 1, redeemBudgetSen: 300, sessionYear: 2026, miniGamesGiveCoins: false }

/** The four setting keys stored in `reward_settings`: ranges of 48 section 2, messages of 30 P09-01..04. */
const KEYS = {
  reward_budget_sen_session: { column: 'redeemBudgetSen', min: 0, max: 100_000, message: 'Bajet tidak sah.' },
  flat_quiz_reward: { column: 'coinsPerCorrect', min: 0, max: 20, message: 'Nilai mesti antara 0 dan 20.' },
  current_session_year: { column: 'sessionYear', min: 2020, max: 2100, message: 'Tahun tidak sah.' },
  games_award_syiling: { column: 'miniGamesGiveCoins', min: 0, max: 1, message: MSG.invalid },
} as const
type RewardSettingKey = keyof typeof KEYS

export function isRewardSettingKey(key: string): key is RewardSettingKey {
  return Object.hasOwn(KEYS, key)
}

/** The message of a value outside the key's range; undefined when it is fine. */
export function rewardSettingError(key: RewardSettingKey, value: number): string | undefined {
  const { min, max, message } = KEYS[key]
  return Number.isInteger(value) && value >= min && value <= max ? undefined : message
}

/** The row as the key and value list of the settings screens sees it (a toggle is 0 or 1). */
export function rewardSettingsByKey(values: RewardSettingsValues): ReadonlyMap<string, number> {
  return new Map(Object.entries(KEYS).map(([key, { column }]) => [key, Number(values[column])]))
}

function valuesOf(row: RewardSettingsValues): RewardSettingsValues {
  return { coinsPerCorrect: row.coinsPerCorrect, redeemBudgetSen: row.redeemBudgetSen, sessionYear: row.sessionYear, miniGamesGiveCoins: row.miniGamesGiveCoins }
}

@Injectable()
export class RewardSettingsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async read(db: TxClient | PrismaClient = this.prisma.client): Promise<RewardSettingsValues> {
    const row = await db.rewardSetting.findUnique({ where: { id: 1 } })
    return row ? valuesOf(row) : DEFAULTS
  }

  /**
   * Writes only the posted keys (the caller checked them with `rewardSettingError`), so two admins saving different keys
   * cannot overwrite each other; answers the row before and after for the audit, `after` as the write left it.
   */
  async save(tx: TxClient, values: readonly { key: RewardSettingKey; value: number }[], updatedBy: string, at: Date): Promise<{ before: RewardSettingsValues; after: RewardSettingsValues }> {
    const before = await this.read(tx)
    const posted: Partial<RewardSettingsValues> = {}
    for (const { key, value } of values) {
      if (key === 'games_award_syiling') posted.miniGamesGiveCoins = value === 1
      else posted[KEYS[key].column] = value
    }
    const stamp = { updatedBy: idFromString(updatedBy), updatedAt: at }
    const row = await tx.rewardSetting.upsert({ where: { id: 1 }, create: { ...before, ...posted, ...stamp }, update: { ...posted, ...stamp } })
    return { before, after: valuesOf(row) }
  }
}
