import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { GAME_SETTINGS } from '../../src/modules/games'
import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * S7-T01 part 1, migration 0224: DM-60, DM-64 and the DM-38 key rows. The test database already ran every migration, so
 * each case runs the reversal written in the file's own comment and then the file again, on the rows it set up.
 */
const MIGRATION = readFileSync(fileURLToPath(new URL('../../prisma/migrations/0224_s7_game_engine/migration.sql', import.meta.url)), 'utf8')
const REVERSE = MIGRATION.split('\n')
  .filter((line) => /^-- {3}(DELETE|ALTER|DROP) /.test(line))
  .map((line) => line.slice(5))
  .join('\n')

const REWARD_KEYS = ['flat_quiz_reward', 'games_award_syiling', 'reward_budget_sen_session', 'current_session_year']
const OTHER_OLD_KEYS = ['coins_per_question', 'cash_rate_coins', 'cash_rate_sen', 'min_cash_withdrawal', 'cash_withdrawal_enabled', 'reward_budget_sen_month']

/** 48 section 2: key, default, BM label. */
const ROWS: readonly (readonly [string, number, string])[] = [
  ['xp_per_correct', 10, 'Mata (XP) setiap jawapan betul'],
  ['xp_level_size', 1000, 'Saiz tahap (mata)'],
  ['games_daily_syiling_cap', 100, 'Had syiling permainan sehari'],
  ['games_daily_xp_cap', 500, 'Had mata permainan sehari'],
  ['game_win_xp', 20, 'Mata untuk menang'],
  ['game_draw_xp', 10, 'Mata untuk seri'],
  ['game_play_xp', 5, 'Mata untuk bermain'],
  ['game_win_bonus_syiling', 5, 'Bonus syiling untuk menang'],
  ['games_min_ms_per_answer', 1000, 'Masa minimum setiap jawapan (ms)'],
  ['jutawan_min_ms_per_answer', 2000, 'Masa minimum setiap jawapan Jutawan (ms)'],
  ['jutawan_question_seconds', 60, 'Masa setiap soalan Jutawan (saat)'],
  ['battle_questions_default', 10, 'Bilangan soalan Battle (lalai)'],
  ['battle_question_seconds', 15, 'Masa setiap soalan Battle (saat)'],
  ['battle_grace_seconds', 3, 'Masa tambahan Battle (saat)'],
  ['battle_queue_seconds', 120, 'Tempoh menunggu lawan (saat)'],
  ['battle_bot_fallback_seconds', 30, 'Saat sebelum Robot PrestasiPlus'],
  ['battle_bot_accuracy_pct', 60, 'Ketepatan Robot PrestasiPlus (%)'],
  ['battle_invitation_hours', 24, 'Tempoh cabaran kawan (jam)'],
  ['battle_daily_max', 20, 'Had Battle sehari'],
  ['games_room_bots_enabled', 1, 'Robot dalam bilik permainan'],
  ['games_absent_seconds', 30, 'Saat sebelum pemain dianggap tiada'],
  ['room_waiting_minutes', 15, 'Tempoh bilik menunggu (minit)'],
  ['boardgame_quiz_tiles', 35, 'Bilangan Petak Soalan'],
  ['challenge_accuracy_min_questions', 5, 'Soalan minimum untuk cabaran ketepatan'],
  ['daily_login_syiling', 2, 'Syiling log masuk harian'],
  ['spm_first_session_syiling', 7, 'Syiling sesi SPM pertama sehari'],
  ['mystery_box_cost', 50, 'Kos satu kotak (syiling)'],
  ['mystery_box_daily_max', 5, 'Had kotak sehari'],
  ['draw_max_tickets_per_pupil', 10, 'Max tiket / pelajar'],
  ['referral_referrer_syiling', 100, 'Syiling untuk pemberi rujukan'],
  ['referral_referee_syiling', 0, 'Syiling untuk kawan yang dirujuk'],
  ['referral_max_rewarded', 20, 'Had kawan berganjaran setiap pelajar'],
  ['mission_reward_max', 100, 'Had ganjaran misi (syiling)'],
  ['sekolah_bersaing_min_pupils', 1, 'Pelajar minimum setiap sekolah'],
  ['sekolah_bersaing_top_n', 30, 'Bilangan sekolah dipaparkan'],
]

describe('migration 0224 game engine', () => {
  let db: TestDatabase

  const settings = async () => {
    const rows = await db.query<{ key: string; value: string; label: string }>(`select key, value::text, label from gamification_settings`)
    return new Map(rows.map((r) => [r.key, { value: Number(r.value), label: r.label }]))
  }
  const rejects = async (sql: string, params: unknown[] = []): Promise<string> => {
    try {
      await db.query(sql, params)
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
    throw new Error(`Expected the statement to be rejected: ${sql}`)
  }
  const reverse = () => db.query(REVERSE)
  const apply = () => db.query(MIGRATION)
  const addBattle = async () => {
    const [battle] = await db.query<{ id: string }>(`insert into battles (mode, question_type) values ('quick_match', 'biasa') returning id::text`)
    return battle!.id
  }

  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })
  beforeEach(async () => {
    await reverse()
    await db.query('delete from battles')
    await db.query('delete from gamification_settings')
    await db.query(`update game_settings set boardgame_quiz_tiles = 35`)
    await apply()
  })

  describe('DM-38 key rows', () => {
    it('has one row with the label and default of 48 section 2 for each key, and nothing else', async () => {
      const rows = await settings()
      expect(rows.size).toBe(35)
      for (const [key, value, label] of ROWS) expect(rows.get(key), key).toEqual({ value, label })
    })

    it('every row is the default the reader falls back to', async () => {
      const rows = await settings()
      expect(Object.keys(GAME_SETTINGS).sort()).toEqual(ROWS.map(([key]) => key).sort())
      for (const [key, spec] of Object.entries(GAME_SETTINGS)) expect(rows.get(key)?.value, key).toBe(spec.default)
    })

    it('does not insert the four reward_settings keys or the other old keys', async () => {
      const rows = await settings()
      for (const key of [...REWARD_KEYS, ...OTHER_OLD_KEYS]) expect(rows.has(key), key).toBe(false)
    })

    it('the check allows the ten old keys and every new key', async () => {
      await db.query('delete from gamification_settings')
      for (const key of [...REWARD_KEYS, ...OTHER_OLD_KEYS, ...ROWS.map(([k]) => k)]) {
        await db.query(`insert into gamification_settings (key, value, label) values ($1, 1, 'Label')`, [key])
      }
      expect((await settings()).size).toBe(45)
    })

    it('the check refuses an unknown key', async () => {
      expect(await rejects(`insert into gamification_settings (key, value, label) values ('unknown_key', 1, 'Label')`)).toMatch(/ck_gamification_settings_key/)
    })

    it('keeps the old rows as they are, whether or not the four keys have moved', async () => {
      await reverse()
      await db.query(`insert into gamification_settings (key, value, label) values ('flat_quiz_reward', 3, 'Lama'), ('cash_rate_sen', 8, 'Sen')`)
      await apply()
      const rows = await settings()
      expect(rows.get('flat_quiz_reward')).toEqual({ value: 3, label: 'Lama' })
      expect(rows.get('cash_rate_sen')).toEqual({ value: 8, label: 'Sen' })
      expect(rows.size).toBe(37)
    })

    it('a row that already exists is not overwritten', async () => {
      await db.query('drop table spin_segments')
      await db.query('alter table battles drop column counts_for_ranking')
      await db.query(`update gamification_settings set value = 50, label = 'Disimpan' where key = 'xp_per_correct'`)
      await apply()
      expect((await settings()).get('xp_per_correct')).toEqual({ value: 50, label: 'Disimpan' })
    })

    it('boardgame_quiz_tiles starts from the saved game_settings value, else its default', async () => {
      await reverse()
      await db.query(`update game_settings set boardgame_quiz_tiles = 20`)
      await apply()
      expect((await settings()).get('boardgame_quiz_tiles')).toEqual({ value: 20, label: 'Bilangan Petak Soalan' })
      await reverse()
      await db.query('delete from game_settings')
      await apply()
      expect((await settings()).get('boardgame_quiz_tiles')?.value).toBe(35)
      await db.query(`insert into game_settings (id, boardgame_quiz_tiles) values (1, 35)`)
    })
  })

  describe('DM-60', () => {
    it('a battle counts for ranking by default, and an existing battle keeps counting', async () => {
      await reverse()
      const before = await addBattle()
      await apply()
      const after = await addBattle()
      const rows = await db.query<{ id: string; counts_for_ranking: boolean }>(`select id::text, counts_for_ranking from battles`)
      expect(rows.map((r) => [r.id, r.counts_for_ranking]).sort()).toEqual([[before, true], [after, true]].sort())
      expect(await rejects(`update battles set counts_for_ranking = null`)).toMatch(/counts_for_ranking/)
    })

    it('a robot participant has no user; a user id must still exist', async () => {
      const battle = await addBattle()
      await db.query(`insert into battle_participants (battle_id, side, user_id, is_bot) values ($1::uuid, 'B', null, true)`, [battle])
      expect(await db.query(`select 1 from battle_participants where battle_id = $1::uuid and user_id is null`, [battle])).toHaveLength(1)
      expect(await rejects(`insert into battle_participants (battle_id, side, user_id) values ($1::uuid, 'A', 999999)`, [battle])).toMatch(/fk_battle_participants_user_id/)
    })
  })

  describe('DM-64', () => {
    it('seeds the 8 segments of 48 GAME-14, all active, weights total 100', async () => {
      const rows = await db.query<{ position: number; label: string; syiling: number; weight: number; active: boolean }>(`select position, label, syiling, weight, active from spin_segments order by position`)
      expect(rows.map((r) => [r.position, r.label, r.syiling, r.weight])).toEqual([
        [1, '1 Syiling', 1, 25],
        [2, '3 Syiling', 3, 20],
        [3, '5 Syiling', 5, 15],
        [4, '10 Syiling', 10, 8],
        [5, '20 Syiling', 20, 3],
        [6, 'Cuba Lagi', 0, 15],
        [7, '2 Syiling', 2, 10],
        [8, '7 Syiling', 7, 4],
      ])
      expect(rows.every((r) => r.active)).toBe(true)
      expect(rows.reduce((sum, r) => sum + r.weight, 0)).toBe(100)
    })

    it('refuses a position, label, syiling or weight outside the rules of 48 GAME-14', async () => {
      expect(await rejects(`insert into spin_segments (position, label, syiling, weight) values (9, 'x', 0, 0)`)).toMatch(/ck_spin_segments_position/)
      expect(await rejects(`insert into spin_segments (position, label, syiling, weight) values (1, 'x', 0, 0)`)).toMatch(/spin_segments_pkey/)
      expect(await rejects(`update spin_segments set label = $1 where position = 1`, ['x'.repeat(21)])).toMatch(/ck_spin_segments_label/)
      expect(await rejects(`update spin_segments set syiling = 101 where position = 1`)).toMatch(/ck_spin_segments_syiling/)
      expect(await rejects(`update spin_segments set weight = -1 where position = 1`)).toMatch(/ck_spin_segments_weight/)
    })
  })

  it('the reversal in the comment undoes all of it', async () => {
    const battle = await addBattle()
    await reverse()
    expect((await settings()).size).toBe(0)
    expect(await rejects(`insert into gamification_settings (key, value, label) values ('xp_per_correct', 1, 'Label')`)).toMatch(/ck_gamification_settings_key/)
    await db.query(`insert into gamification_settings (key, value, label) values ('cash_rate_sen', 1, 'Label')`)
    expect(await rejects('select 1 from spin_segments')).toMatch(/spin_segments/)
    expect(await rejects('select counts_for_ranking from battles')).toMatch(/counts_for_ranking/)
    expect(await rejects(`insert into battle_participants (battle_id, side, user_id, is_bot) values ($1::uuid, 'B', null, true)`, [battle])).toMatch(/user_id/)
    await db.query('delete from gamification_settings')
    await apply()
  })
})
