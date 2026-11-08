import { Inject, Injectable } from '@nestjs/common'

import type { PrismaClient, TxClient } from '../../../db/client'
import { PrismaService } from '../../../db/prisma.service'

interface RangeSpec {
  readonly default: number
  readonly min: number
  readonly max: number
}

interface ChoiceSpec {
  readonly default: number
  readonly oneOf: readonly number[]
}

/**
 * Every key of 48 section 2 stored in `gamification_settings` (DM-38), with its default and range. Toggles are 0 or 1.
 * The four `reward_settings` keys (DM-48: flat_quiz_reward, games_award_syiling, reward_budget_sen_session,
 * current_session_year) are not here and are never served: read them through their owner.
 */
export const GAME_SETTINGS = {
  xp_per_correct: { default: 10, min: 1, max: 100 },
  xp_level_size: { default: 1000, min: 100, max: 10_000 },
  games_daily_syiling_cap: { default: 100, min: 0, max: 1000 },
  games_daily_xp_cap: { default: 500, min: 0, max: 5000 },
  game_win_xp: { default: 20, min: 0, max: 100 },
  game_draw_xp: { default: 10, min: 0, max: 100 },
  game_play_xp: { default: 5, min: 0, max: 100 },
  game_win_bonus_syiling: { default: 5, min: 0, max: 50 },
  games_min_ms_per_answer: { default: 1000, min: 0, max: 5000 },
  jutawan_min_ms_per_answer: { default: 2000, min: 0, max: 5000 },
  jutawan_question_seconds: { default: 60, min: 10, max: 300 },
  battle_questions_default: { default: 10, oneOf: [5, 10, 15, 20] },
  battle_question_seconds: { default: 15, min: 10, max: 60 },
  battle_grace_seconds: { default: 3, min: 0, max: 10 },
  battle_queue_seconds: { default: 120, min: 30, max: 600 },
  battle_bot_fallback_seconds: { default: 30, min: 0, max: 120 },
  battle_bot_accuracy_pct: { default: 60, min: 10, max: 90 },
  battle_invitation_hours: { default: 24, min: 1, max: 72 },
  battle_daily_max: { default: 20, min: 1, max: 100 },
  games_room_bots_enabled: { default: 1, min: 0, max: 1 },
  games_absent_seconds: { default: 30, min: 10, max: 120 },
  room_waiting_minutes: { default: 15, min: 5, max: 60 },
  challenge_accuracy_min_questions: { default: 5, min: 1, max: 20 },
  daily_login_syiling: { default: 2, min: 0, max: 10 },
  spm_first_session_syiling: { default: 7, min: 0, max: 20 },
  mystery_box_cost: { default: 50, min: 1, max: 500 },
  mystery_box_daily_max: { default: 5, min: 1, max: 20 },
  draw_max_tickets_per_pupil: { default: 10, min: 1, max: 100 },
  referral_referrer_syiling: { default: 100, min: 0, max: 1000 },
  referral_referee_syiling: { default: 0, min: 0, max: 1000 },
  referral_max_rewarded: { default: 20, min: 1, max: 200 },
  mission_reward_max: { default: 100, min: 0, max: 10_000 },
  sekolah_bersaing_min_pupils: { default: 1, min: 1, max: 50 },
  sekolah_bersaing_top_n: { default: 30, min: 10, max: 100 },
  'game_enabled_papan-bijak': { default: 1, min: 0, max: 1 },
  'game_enabled_battle': { default: 1, min: 0, max: 1 },
  'game_enabled_perang-fakta': { default: 1, min: 0, max: 1 },
  'game_enabled_benteng-ilmu': { default: 1, min: 0, max: 1 },
  'game_enabled_perlumbaan-matematik': { default: 1, min: 0, max: 1 },
  'game_enabled_kuiz-relay': { default: 1, min: 0, max: 1 },
  'game_enabled_teka-silang-kata': { default: 1, min: 0, max: 1 },
  'game_enabled_betul-salah': { default: 1, min: 0, max: 1 },
  'game_enabled_cabaran-kilat': { default: 1, min: 0, max: 1 },
  'game_enabled_tembak-jawapan': { default: 1, min: 0, max: 1 },
  'game_enabled_susun-jawapan': { default: 1, min: 0, max: 1 },
  'game_enabled_kad-memori': { default: 1, min: 0, max: 1 },
  'game_enabled_jutawan': { default: 1, min: 0, max: 1 },
  'game_enabled_roda-nasib': { default: 1, min: 0, max: 1 },
} as const satisfies Record<string, RangeSpec | ChoiceSpec>

export type GameSettingKey = keyof typeof GAME_SETTINGS

export function isGameSettingKey(key: string): key is GameSettingKey {
  return Object.hasOwn(GAME_SETTINGS, key)
}

/** True when `value` is a whole number inside the range of the key in 48 section 2. */
export function isGameSettingValueInRange(key: GameSettingKey, value: number): boolean {
  const spec: RangeSpec | ChoiceSpec = GAME_SETTINGS[key]
  if (!Number.isInteger(value)) return false
  return 'oneOf' in spec ? spec.oneOf.includes(value) : value >= spec.min && value <= spec.max
}

export interface GameSettingWrite {
  key: GameSettingKey
  value: number
  /** The BM label of 48 section 2, for a row that the migration did not leave behind. */
  label: string
}

/**
 * The one settings reader of the games, in place of code constants (S7-T01 part 1). A value is read on each call, so a
 * saved change applies to the next event (48 section 2). A key with no row, or with a value outside its range, answers
 * the default of 48 section 2. It only reads; refusing bad input belongs to the screen that saves it.
 */
@Injectable()
export class GameSettingsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(key: GameSettingKey, db?: TxClient | PrismaClient): Promise<number> {
    return (await this.getMany([key], db))[key]
  }

  /** The values of `keys`, read together. */
  async getMany<K extends GameSettingKey>(keys: readonly K[], db: TxClient | PrismaClient = this.prisma.client): Promise<Record<K, number>> {
    for (const key of keys) {
      if (!isGameSettingKey(key)) throw new Error(`Not a game setting: ${String(key)}`)
    }
    const rows = await db.gamificationSetting.findMany({ where: { key: { in: [...keys] } }, select: { key: true, value: true } })
    const stored = new Map(rows.map((r) => [r.key, r.value.toNumber()]))
    const values = {} as Record<K, number>
    for (const key of keys) {
      const value = stored.get(key)
      values[key] = value !== undefined && isGameSettingValueInRange(key, value) ? value : GAME_SETTINGS[key].default
    }
    return values
  }

  /**
   * Saves `writes` with the caller's transaction, so they commit or roll back with the rest of its save. Refusing bad
   * input belongs to the screen; a key or value that reaches this point out of range is a programming error.
   */
  async setMany(writes: readonly GameSettingWrite[], at: Date, tx: TxClient): Promise<void> {
    for (const { key, value } of writes) {
      if (!isGameSettingKey(key) || !isGameSettingValueInRange(key, value)) {
        throw new Error(`Not a writable game setting: ${String(key)}=${String(value)}`)
      }
    }
    for (const { key, value, label } of writes) {
      await tx.gamificationSetting.upsert({
        where: { key },
        update: { value, updatedAt: at },
        create: { key, value, label, updatedAt: at },
      })
    }
  }
}
