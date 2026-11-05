import 'reflect-metadata'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { PrismaService } from '../../../src/db/prisma.service'
import { GAME_SETTINGS, GameSettingsService, GamesCoreModule, isGameSettingKey, isGameSettingValueInRange, type GameSettingKey } from '../../../src/modules/games'
import { createTestDatabase, type TestDatabase } from '../../support/db'

const REWARD_KEYS = ['flat_quiz_reward', 'games_award_syiling', 'reward_budget_sen_session', 'current_session_year']

describe('GameSettingsService', () => {
  let db: TestDatabase
  let settings: GameSettingsService

  const store = (key: GameSettingKey, value: number) => db.query(`update gamification_settings set value = $2 where key = $1`, [key, value])

  beforeAll(async () => {
    db = await createTestDatabase()
    settings = new GameSettingsService({ client: db.prisma } as unknown as PrismaService)
  })
  afterAll(async () => {
    await db.drop()
  })
  beforeEach(async () => {
    for (const [key, spec] of Object.entries(GAME_SETTINGS)) {
      await db.query(`insert into gamification_settings (key, value, label) values ($1, $2, 'Label') on conflict (key) do update set value = $2`, [key, spec.default])
    }
  })

  it('is exported by the games core module', () => {
    expect(Reflect.getMetadata('exports', GamesCoreModule)).toContain(GameSettingsService)
  })

  it('answers the stored value', async () => {
    await store('xp_per_correct', 25)
    expect(await settings.get('xp_per_correct')).toBe(25)
  })

  it('answers the default of 48 section 2 when the row is absent', async () => {
    await db.query(`delete from gamification_settings`)
    for (const [key, spec] of Object.entries(GAME_SETTINGS)) {
      expect(await settings.get(key as GameSettingKey), key).toBe(spec.default)
    }
  })

  it.each<[GameSettingKey, number, number]>([
    ['xp_per_correct', 0, 10],
    ['xp_per_correct', 101, 10],
    ['battle_bot_accuracy_pct', 91, 60],
    ['games_room_bots_enabled', 2, 1],
    ['boardgame_quiz_tiles', 39, 35],
    ['battle_questions_default', 12, 10],
    ['game_win_xp', 20.5, 20],
    ['mission_reward_max', 10_001, 100],
  ])('answers the default when %s is out of range (%d)', async (key, stored, expected) => {
    await store(key, stored)
    expect(await settings.get(key)).toBe(expected)
  })

  it.each<[GameSettingKey, number]>([
    ['xp_per_correct', 1],
    ['xp_per_correct', 100],
    ['battle_bot_fallback_seconds', 0],
    ['games_daily_syiling_cap', 0],
    ['games_room_bots_enabled', 0],
    ['boardgame_quiz_tiles', 0],
    ['boardgame_quiz_tiles', 38],
    ['battle_questions_default', 5],
    ['battle_questions_default', 20],
    ['referral_referee_syiling', 1000],
  ])('keeps %s = %d, inside its range', async (key, stored) => {
    await store(key, stored)
    expect(await settings.get(key)).toBe(stored)
  })

  it('getMany answers exactly the keys asked for, each by the same rules', async () => {
    await store('game_win_xp', 30)
    await store('game_draw_xp', 101)
    await db.query(`delete from gamification_settings where key = 'game_play_xp'`)
    expect(await settings.getMany(['game_win_xp', 'game_draw_xp', 'game_play_xp'])).toEqual({ game_win_xp: 30, game_draw_xp: 10, game_play_xp: 5 })
    expect(await settings.getMany([])).toEqual({})
  })

  it('reads through the handle it is given, so a transaction sees its own write', async () => {
    const seen = await db.prisma.$transaction(async (tx) => {
      await tx.gamificationSetting.update({ where: { key: 'game_win_xp' }, data: { value: 40 } })
      const inside = await settings.get('game_win_xp', tx)
      await tx.gamificationSetting.update({ where: { key: 'game_win_xp' }, data: { value: 20 } })
      return inside
    })
    expect(seen).toBe(40)
  })

  describe('the four reward_settings keys', () => {
    it('are not game settings', () => {
      for (const key of REWARD_KEYS) {
        expect(isGameSettingKey(key), key).toBe(false)
        expect(Object.hasOwn(GAME_SETTINGS, key), key).toBe(false)
      }
    })

    it('are not served even when a row exists, and the row is left alone', async () => {
      await db.query(`insert into gamification_settings (key, value, label) values ('flat_quiz_reward', 7, 'Label') on conflict (key) do update set value = 7`)
      await expect(settings.get('flat_quiz_reward' as GameSettingKey)).rejects.toThrow('Not a game setting: flat_quiz_reward')
      await expect(settings.getMany(['game_win_xp', 'games_award_syiling' as GameSettingKey])).rejects.toThrow('Not a game setting: games_award_syiling')
      const rows = await db.query<{ value: string }>(`select value::text from gamification_settings where key = 'flat_quiz_reward'`)
      expect(rows).toEqual([{ value: '7.00' }])
    })
  })

  it('isGameSettingValueInRange follows the range of the key', () => {
    expect(isGameSettingValueInRange('battle_questions_default', 15)).toBe(true)
    expect(isGameSettingValueInRange('battle_questions_default', 16)).toBe(false)
    expect(isGameSettingValueInRange('xp_level_size', 100)).toBe(true)
    expect(isGameSettingValueInRange('xp_level_size', 99)).toBe(false)
    expect(isGameSettingValueInRange('xp_level_size', 100.5)).toBe(false)
  })
})
