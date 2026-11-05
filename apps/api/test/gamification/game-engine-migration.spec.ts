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
const GAME_ROWS: readonly (readonly [string, number, string])[] = [
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

/** The games on the hub with their hub names (ruling 2 on #499). */
const HUB_GAMES: readonly (readonly [string, string])[] = [
  ['papan-bijak', 'Papan Bijak'],
  ['battle', 'Battle Arena'],
  ['perang-fakta', 'Perang Fakta'],
  ['benteng-ilmu', 'Benteng Ilmu'],
  ['perlumbaan-matematik', 'Perlumbaan Matematik'],
  ['kuiz-relay', 'Kuiz Relay'],
  ['teka-silang-kata', 'Teka Silang Kata'],
  ['betul-salah', 'Betul atau Salah'],
  ['cabaran-kilat', 'Cabaran Kilat'],
  ['tembak-jawapan', 'Tembak Jawapan'],
  ['susun-jawapan', 'Susun Jawapan'],
  ['sambung-kata', 'Sambung Kata'],
  ['kad-memori', 'Kad Memori'],
  ['jutawan', 'Jutawan Ilmu'],
  ['roda-nasib', 'Roda Nasib'],
]

/** Every row the migration inserts. */
const ROWS: readonly (readonly [string, number, string])[] = [...GAME_ROWS, ...HUB_GAMES.map(([key, name]): [string, number, string] => [`game_enabled_${key}`, 1, name])]

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
  const addUser = async () => {
    const [user] = await db.query<{ id: string }>(`insert into users (name) values ('Pengguna') returning id::text`)
    return user!.id
  }
  const addQuestion = async () => {
    const [question] = await db.query<{ id: string }>(`insert into questions default values returning id::text`)
    return question!.id
  }
  const addQueue = async () => {
    const [queue] = await db.query<{ id: string }>(`insert into battle_queues (owner_id, mode, question_type) values ($1::bigint, 'quick_match', 'biasa') returning id::text`, [await addUser()])
    return queue!.id
  }
  const addInvitation = async () => {
    const [invitation] = await db.query<{ id: string }>(`insert into battle_invitations (sender_id, receiver_id, question_type) values ($1::bigint, $2::bigint, 'biasa') returning id::text`, [await addUser(), await addUser()])
    return invitation!.id
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
    await apply()
  })

  describe('DM-38 key rows', () => {
    it('has one row with the label and default of 48 section 2 for each key, and nothing else', async () => {
      const rows = await settings()
      expect(rows.size).toBe(49)
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
      expect((await settings()).size).toBe(59)
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
      expect(rows.size).toBe(51)
    })

    it('a row that already exists is not overwritten', async () => {
      await db.query('drop table spin_segments')
      await db.query('alter table battles drop column counts_for_ranking, drop column round_started_at, drop column question_count')
      await db.query('alter table battle_queues drop column question_count')
      await db.query('alter table battle_invitations drop column question_count')
      await db.query('alter table battle_participants drop column last_polled_at, drop column consecutive_timeouts')
      await db.query('drop index uq_battle_answers_robot_battle_id_position')
      await db.query(`update gamification_settings set value = 50, label = 'Disimpan' where key = 'xp_per_correct'`)
      await apply()
      expect((await settings()).get('xp_per_correct')).toEqual({ value: 50, label: 'Disimpan' })
    })

    it('boardgame_quiz_tiles is not a key: the check refuses it and it stays in game_settings (ruling 5 on #499)', async () => {
      expect((await settings()).has('boardgame_quiz_tiles')).toBe(false)
      expect(await rejects(`insert into gamification_settings (key, value, label) values ('boardgame_quiz_tiles', 35, 'Label')`)).toMatch(/ck_gamification_settings_key/)
      const [row] = await db.query<{ boardgame_quiz_tiles: number }>(`select boardgame_quiz_tiles from game_settings where id = 1`)
      expect(row?.boardgame_quiz_tiles).toBe(35)
    })

    it('every hub game has game_enabled_<key> on, with its hub name; tournament has none (D-G, ruling 2 on #499)', async () => {
      const rows = await settings()
      expect(HUB_GAMES).toHaveLength(15)
      for (const [key, name] of HUB_GAMES) expect(rows.get(`game_enabled_${key}`), key).toEqual({ value: 1, label: name })
      expect(rows.has('game_enabled_tournament')).toBe(false)
      expect(await rejects(`insert into gamification_settings (key, value, label) values ('game_enabled_tournament', 1, 'Label')`)).toMatch(/ck_gamification_settings_key/)
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

  describe('DM-60, the columns of 48 GAME-01 (ruling 5 on #497)', () => {
    const COUNT_TABLES = ['battles', 'battle_queues', 'battle_invitations'] as const
    const addRow = { battles: addBattle, battle_queues: addQueue, battle_invitations: addInvitation }

    it('battles.round_started_at: null on an existing battle, stores a time with its zone', async () => {
      await reverse()
      const before = await addBattle()
      await apply()
      const after = await addBattle()
      const read = (id: string) => db.query<{ round_started_at: Date | null }>(`select round_started_at from battles where id = $1::uuid`, [id])
      expect(await read(before)).toEqual([{ round_started_at: null }])
      expect(await read(after)).toEqual([{ round_started_at: null }])
      await db.query(`update battles set round_started_at = '2026-11-05T08:00:00+08:00' where id = $1::uuid`, [after])
      expect((await read(after))[0]?.round_started_at?.toISOString()).toBe('2026-11-05T00:00:00.000Z')
    })

    it.each(COUNT_TABLES)('%s.question_count: an existing row reads 10, a new row defaults to 10, null is refused', async (table) => {
      await reverse()
      await db.query(`delete from ${table}`)
      const before = await addRow[table]()
      await apply()
      const after = await addRow[table]()
      const rows = await db.query<{ question_count: number }>(`select question_count from ${table} where id::text = any($1::text[])`, [[before, after]])
      expect(rows).toEqual([{ question_count: 10 }, { question_count: 10 }])
      expect(await rejects(`update ${table} set question_count = null`)).toMatch(/question_count/)
    })

    it.each(COUNT_TABLES)('%s.question_count: the check allows only the chips 5, 10, 15, 20', async (table) => {
      const id = await addRow[table]()
      const where = `where id::text = $1`
      for (const count of [5, 10, 15, 20]) {
        await db.query(`update ${table} set question_count = ${String(count)} ${where}`, [id])
      }
      for (const count of [0, 4, 7, 21]) {
        expect(await rejects(`update ${table} set question_count = ${String(count)} ${where}`, [id])).toMatch(new RegExp(`ck_${table}_question_count`))
      }
    })

    it('battle_participants.last_polled_at and consecutive_timeouts: an existing row reads null and 0, a run below 0 is refused', async () => {
      await reverse()
      const battle = await addBattle()
      const user = await addUser()
      await db.query(`insert into battle_participants (battle_id, side, user_id) values ($1::uuid, 'A', $2::bigint)`, [battle, user])
      await apply()
      const read = () => db.query<{ last_polled_at: Date | null; consecutive_timeouts: number }>(`select last_polled_at, consecutive_timeouts from battle_participants where battle_id = $1::uuid`, [battle])
      expect(await read()).toEqual([{ last_polled_at: null, consecutive_timeouts: 0 }])
      await db.query(`update battle_participants set last_polled_at = '2026-11-05T08:00:00+08:00', consecutive_timeouts = 3 where battle_id = $1::uuid`, [battle])
      const [stored] = await read()
      expect(stored?.last_polled_at?.toISOString()).toBe('2026-11-05T00:00:00.000Z')
      expect(stored?.consecutive_timeouts).toBe(3)
      expect(await rejects(`update battle_participants set consecutive_timeouts = -1`)).toMatch(/ck_battle_participants_consecutive_timeouts/)
      expect(await rejects(`update battle_participants set consecutive_timeouts = null`)).toMatch(/consecutive_timeouts/)
    })

    it('ck_battle_queues_status adds cancelled, keeps every old status and refuses an unknown one', async () => {
      const queue = await addQueue()
      for (const status of ['waiting', 'incoming_challenge', 'matched', 'expired', 'abandoned', 'cancelled']) {
        await db.query(`update battle_queues set status = $1 where id = $2::bigint`, [status, queue])
      }
      expect(await rejects(`update battle_queues set status = 'declined' where id = $1::bigint`, [queue])).toMatch(/ck_battle_queues_status/)
    })

    it('ck_battles_status stays the four of BATTLE_STATUSES: a battle is never cancelled', async () => {
      const battle = await addBattle()
      for (const status of ['active', 'finished', 'forfeited', 'abandoned']) await db.query(`update battles set status = $1 where id = $2::uuid`, [status, battle])
      expect(await rejects(`update battles set status = 'cancelled' where id = $1::uuid`, [battle])).toMatch(/ck_battles_status/)
    })

    it('battle_answers.user_id: null for a robot; a human answer is kept as it was and a user id must still exist', async () => {
      const battle = await addBattle()
      const question = await addQuestion()
      const insert = `insert into battle_answers (battle_id, user_id, position, question_id, correct, seconds, points) values ($1::uuid, $2::bigint, $3, $4::bigint, true, 1, 967)`
      await db.query(insert, [battle, null, 1, question])
      const user = await addUser()
      await db.query(insert, [battle, user, 1, question])
      const rows = await db.query<{ user_id: string | null }>(`select user_id::text from battle_answers where battle_id = $1::uuid order by user_id nulls first`, [battle])
      expect(rows).toEqual([{ user_id: null }, { user_id: user }])
      expect(await rejects(insert, [battle, user, 1, question])).toMatch(/uq_battle_answers_battle_id_user_id_position/)
      expect(await rejects(insert, [battle, '999999999', 2, question])).toMatch(/fk_battle_answers_user_id/)
    })
  })

  describe('DM-60, the limits of 48 GAME-01 (ruling 5 on #497)', () => {
    const answer = `insert into battle_answers (battle_id, user_id, position, question_id, option_id, correct, seconds, points) values ($1::uuid, $2::bigint, $3, $4::bigint, $5, false, 1, 0)`

    it('ck_battle_invitations_status adds cancelled, keeps every old status and refuses an unknown one', async () => {
      const invitation = await addInvitation()
      for (const status of ['pending', 'accepted', 'declined', 'expired', 'cancelled']) {
        await db.query(`update battle_invitations set status = $1 where id = $2::uuid`, [status, invitation])
      }
      expect(await rejects(`update battle_invitations set status = 'abandoned' where id = $1::uuid`, [invitation])).toMatch(/ck_battle_invitations_status/)
    })

    it('ck_battles_answered and ck_battle_participants_correct reach 20 (the largest chip) and refuse 21', async () => {
      const battle = await addBattle()
      await db.query(`update battles set answered = 20 where id = $1::uuid`, [battle])
      expect(await rejects(`update battles set answered = 21 where id = $1::uuid`, [battle])).toMatch(/ck_battles_answered/)
      await db.query(`insert into battle_participants (battle_id, side, user_id, is_bot, correct) values ($1::uuid, 'B', null, true, 20)`, [battle])
      expect(await rejects(`update battle_participants set correct = 21 where battle_id = $1::uuid`, [battle])).toMatch(/ck_battle_participants_correct/)
    })

    it('ck_battle_questions_position and ck_battle_answers_position reach 20 and refuse 21 and 0', async () => {
      const battle = await addBattle()
      const question = await addQuestion()
      const user = await addUser()
      const row = `insert into battle_questions (battle_id, position, question_id) values ($1::uuid, $2, $3::bigint)`
      await db.query(row, [battle, 20, question])
      expect(await rejects(row, [battle, 21, question])).toMatch(/ck_battle_questions_position/)
      expect(await rejects(row, [battle, 0, question])).toMatch(/ck_battle_questions_position/)
      await db.query(answer, [battle, user, 20, question, null])
      expect(await rejects(answer, [battle, user, 21, question, null])).toMatch(/ck_battle_answers_position/)
      expect(await rejects(answer, [battle, user, 0, question, null])).toMatch(/ck_battle_answers_position/)
    })

    it('ck_battle_answers_option_id allows null and 0..7 (48 3.2: 2-8 options) and refuses 8 and -1', async () => {
      const battle = await addBattle()
      const question = await addQuestion()
      const user = await addUser()
      await db.query(answer, [battle, user, 1, question, null])
      for (let option = 0; option <= 7; option++) await db.query(answer, [battle, user, option + 2, question, option])
      expect(await rejects(answer, [battle, user, 10, question, 8])).toMatch(/ck_battle_answers_option_id/)
      expect(await rejects(answer, [battle, user, 10, question, -1])).toMatch(/ck_battle_answers_option_id/)
    })

    it('a robot has one answer per battle and position; a human answer stays protected and does not collide with the robot', async () => {
      const [battle, other] = [await addBattle(), await addBattle()]
      const question = await addQuestion()
      const user = await addUser()
      await db.query(answer, [battle, null, 1, question, 0])
      expect(await rejects(answer, [battle, null, 1, question, 1])).toMatch(/uq_battle_answers_robot_battle_id_position/)
      await db.query(answer, [battle, null, 2, question, 1])
      await db.query(answer, [other, null, 1, question, 1])
      await db.query(answer, [battle, user, 1, question, 2])
      expect(await rejects(answer, [battle, user, 1, question, 3])).toMatch(/uq_battle_answers_battle_id_user_id_position/)
    })

    it('existing rows at the old limits stay as they were', async () => {
      await reverse()
      const battle = await addBattle()
      const question = await addQuestion()
      const user = await addUser()
      await db.query(`update battles set answered = 10 where id = $1::uuid`, [battle])
      await db.query(`insert into battle_participants (battle_id, side, user_id, correct) values ($1::uuid, 'A', $2::bigint, 10)`, [battle, user])
      await db.query(`insert into battle_questions (battle_id, position, question_id) values ($1::uuid, 10, $2::bigint)`, [battle, question])
      await db.query(answer, [battle, user, 10, question, 3])
      await apply()
      expect(await db.query(`select answered from battles where id = $1::uuid`, [battle])).toEqual([{ answered: 10 }])
      expect(await db.query(`select correct from battle_participants where battle_id = $1::uuid`, [battle])).toEqual([{ correct: 10 }])
      expect(await db.query(`select position from battle_questions where battle_id = $1::uuid`, [battle])).toEqual([{ position: 10 }])
      expect(await db.query(`select position, option_id from battle_answers where battle_id = $1::uuid`, [battle])).toEqual([{ position: 10, option_id: 3 }])
    })

    it('the reversal puts the old limits back, and removes only the rows they cannot hold', async () => {
      const [wide, narrow] = [await addBattle(), await addBattle()]
      const question = await addQuestion()
      const user = await addUser()
      const invitation = await addInvitation()
      const kept = await addInvitation()
      await db.query(`update battle_invitations set status = 'cancelled' where id = $1::uuid`, [invitation])
      await db.query(`update battles set question_count = 20, answered = 20 where id = $1::uuid`, [wide])
      await db.query(`insert into battle_participants (battle_id, side, user_id, correct) values ($1::uuid, 'A', $2::bigint, 20)`, [wide, user])
      await db.query(`insert into battle_questions (battle_id, position, question_id) values ($1::uuid, 20, $2::bigint)`, [wide, question])
      await db.query(answer, [wide, user, 20, question, 7])
      await db.query(answer, [narrow, user, 1, question, 3])
      await db.query(answer, [narrow, user, 2, question, 7])
      await reverse()
      expect(await db.query<{ id: string }>(`select id::text from battles where id = any($1::uuid[])`, [[wide, narrow]])).toEqual([{ id: narrow }])
      expect(await db.query<{ position: number }>(`select position from battle_answers where battle_id = $1::uuid`, [narrow])).toEqual([{ position: 1 }])
      expect(await db.query<{ id: string }>(`select id::text from battle_invitations where id = any($1::uuid[])`, [[invitation, kept]])).toEqual([{ id: kept }])
      expect(await rejects(`update battle_invitations set status = 'cancelled' where id = $1::uuid`, [kept])).toMatch(/ck_battle_invitations_status/)
      expect(await rejects(`update battles set answered = 11 where id = $1::uuid`, [narrow])).toMatch(/ck_battles_answered/)
      expect(await rejects(`insert into battle_participants (battle_id, side, user_id, correct) values ($1::uuid, 'A', $2::bigint, 11)`, [narrow, user])).toMatch(/ck_battle_participants_correct/)
      expect(await rejects(`insert into battle_questions (battle_id, position, question_id) values ($1::uuid, 11, $2::bigint)`, [narrow, question])).toMatch(/ck_battle_questions_position/)
      expect(await rejects(answer, [narrow, user, 11, question, null])).toMatch(/ck_battle_answers_position/)
      expect(await rejects(answer, [narrow, user, 3, question, 4])).toMatch(/ck_battle_answers_option_id/)
      expect(await db.query(`select 1 from pg_indexes where indexname = 'uq_battle_answers_robot_battle_id_position'`)).toHaveLength(0)
      await db.query('delete from gamification_settings')
      await apply()
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

  it('the reversal undoes the columns of 48 GAME-01, and removes only the rows the old checks cannot hold', async () => {
    const battle = await addBattle()
    const question = await addQuestion()
    const user = await addUser()
    const queue = await addQueue()
    const cancelled = await addQueue()
    await addInvitation()
    await db.query(`update battle_queues set status = 'cancelled' where id = $1::bigint`, [cancelled])
    const insert = `insert into battle_answers (battle_id, user_id, position, question_id, correct, seconds, points) values ($1::uuid, $2::bigint, 1, $3::bigint, true, 1, 967)`
    await db.query(insert, [battle, null, question])
    await db.query(insert, [battle, user, question])
    await reverse()
    for (const [table, column] of [['battles', 'round_started_at'], ['battles', 'question_count'], ['battle_queues', 'question_count'], ['battle_invitations', 'question_count'], ['battle_participants', 'last_polled_at'], ['battle_participants', 'consecutive_timeouts']] as const) {
      expect(await rejects(`select ${column} from ${table}`), `${table}.${column}`).toMatch(new RegExp(column))
    }
    expect(await db.query<{ id: string }>(`select id::text from battle_queues where id = any($1::bigint[])`, [[queue, cancelled]])).toEqual([{ id: queue }])
    expect(await rejects(`update battle_queues set status = 'cancelled' where id = $1::bigint`, [queue])).toMatch(/ck_battle_queues_status/)
    expect(await db.query<{ user_id: string }>(`select user_id::text from battle_answers where battle_id = $1::uuid`, [battle])).toEqual([{ user_id: user }])
    expect(await rejects(insert, [battle, null, question])).toMatch(/user_id/)
    await db.query('delete from gamification_settings')
    await apply()
  })
})
