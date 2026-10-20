import { GamesKeylessQuestionSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { prngStream } from '../../../src/db/prng'
import { GameQuestions, GameSubjects, GameUsers, GamesPorts, WalletGameRewards, gameRow } from '../../../src/modules/games'
import { enumOfGrade, gradeFits, gradeName, gradeOfEnum, levelCodeOfGrade } from '../../../src/modules/games/core/grades'
import { initialsOf, kadarOf, truncateName } from '../../../src/modules/games/core/names'
import { mytWeek, startOfMytWeek } from '../../../src/modules/games/core/time'
import { ROOM_SUBJECT_CODES } from '../../../src/modules/games/core/subjects'
import { WalletService } from '../../../src/modules/wallet'
import { ACCOUNTS, bootGamesApp, insertMcqQuestions, loginAs, type GamesTestApp } from '../helpers'

describe('games foundation', () => {
  let t: GamesTestApp
  beforeAll(async () => {
    t = await bootGamesApp()
  })
  afterAll(async () => {
    await t.close()
  })

  it('the migration created every games table and the single settings row', async () => {
    const tables = [
      'game_rooms', 'game_room_players', 'game_standings', 'game_sessions', 'game_session_items', 'personal_bests', 'jutawan_stats',
      'spins', 'spin_stats', 'pb_searches', 'game_settings', 'leagues', 'league_class_levels', 'league_schools', 'league_standings',
      'sekolah_bersaing_weeks',
    ]
    for (const name of tables) {
      const rows = await t.db.query<{ n: string }>(`select count(*)::text as n from information_schema.tables where table_name = $1`, [name])
      expect(rows[0]?.n, name).toBe('1')
    }
    const settings = await t.db.query<{ id: number; boardgame_quiz_tiles: number }>('select id, boardgame_quiz_tiles from game_settings')
    expect(settings).toEqual([{ id: 1, boardgame_quiz_tiles: 35 }])
    await expect(t.db.query(`insert into game_settings (id, boardgame_quiz_tiles) values (2, 1)`)).rejects.toThrow()
    await expect(t.db.query(`update game_settings set boardgame_quiz_tiles = 39`)).rejects.toThrow()
  })

  it('GameReadService counts finished room games and submitted sessions, never test rows or bots', async () => {
    const [u] = await t.db.query<{ id: string }>(`select id::text from users where email = $1`, [ACCOUNTS.student])
    const [bot] = await t.db.query<{ id: string }>(`select id::text from users where email = $1`, [ACCOUNTS.student2])
    const userId = (u as { id: string }).id
    const range = { from: new Date('2026-10-01T00:00:00+08:00'), to: new Date('2026-11-01T00:00:00+08:00') }
    expect(await t.reads.countFor([userId], range)).toEqual({ count: 0 })
    expect(await t.reads.countFor([], range)).toEqual({ count: 0 })

    await t.db.query(
      `insert into game_rooms (code, game, subject, grade_level, match_mode, max_players, host_id, status, finished_at)
       values ('AAAAA1','benteng-ilmu','SAINS','TINGKATAN_4','same_grade',2,$1,'finished','2026-10-10T10:00:00+08:00'),
              ('AAAAA2','benteng-ilmu','SAINS','TINGKATAN_4','same_grade',2,$1,'waiting',null)`,
      [userId],
    )
    await t.db.query(
      `insert into game_room_players (room_code, user_id, is_bot) values ('AAAAA1',$1,false),('AAAAA1',$2,true),('AAAAA2',$1,false)`,
      [userId, (bot as { id: string }).id],
    )
    await t.db.query(
      `insert into game_sessions (user_id, game, submitted_at) values ($1,'betul-salah','2026-10-12T10:00:00+08:00'),($1,'cabaran-kilat',null),
         ($1,'kad-memori','2026-12-01T10:00:00+08:00')`,
      [userId],
    )
    await t.db.query(`insert into game_sessions (user_id, game, submitted_at, is_test) values ($1,'betul-salah','2026-10-13T10:00:00+08:00', true)`, [userId])
    expect(await t.reads.countFor([userId], range)).toEqual({ count: 2 })
    expect(await t.reads.countFor([(bot as { id: string }).id], range)).toEqual({ count: 0 })
    await t.db.query('delete from game_sessions')
    await t.db.query('delete from game_rooms')
  })

  it('port defaults, and a port can be bound once only', async () => {
    const ports = t.ports
    expect(ports).toBeInstanceOf(GamesPorts)
    expect(ports.rewards).toBeInstanceOf(WalletGameRewards)
    expect(await ports.rewards.canEarnSyiling('1')).toBe(false)
    expect(await ports.rewards.tierRates('1')).toEqual({ correct: 0, win: 0 })
    expect(await ports.rewards.onGameResult('1', { game: 'benteng_ilmu', event: 'win', coins: 35, xp: 0, key: 'ZZZZZ1' }, { isTest: false })).toEqual({
      coinsCredited: 0,
      xpAdded: 0,
    })
    expect(await ports.weeklyPractice.week('1', new Date(), new Date())).toEqual({ me: null, rows: [] })
    expect(await ports.platformAccuracy.accuracy()).toBe(0)
    expect(await ports.battle.hasBattled('1')).toBe(false)
    ports.provideBattle({ hasBattled: async () => true })
    expect(() => ports.provideBattle({ hasBattled: async () => false })).toThrow('already set')
  })

  it('the wallet rewards port credits once per key with the M14 wording, and never for Mod Pelajar', async () => {
    class Earning extends WalletGameRewards {
      override async canEarnSyiling(): Promise<boolean> {
        return true
      }
    }
    const earning = new Earning(t.app.get(WalletService, { strict: false }))
    const [u] = await t.db.query<{ id: string }>(`select id::text from users where email = $1`, [ACCOUNTS.student])
    const userId = (u as { id: string }).id
    const input = { game: 'benteng_ilmu', event: 'win', coins: 35, xp: 0, key: 'RMFND1' }
    expect(await earning.onGameResult(userId, input, { isTest: false })).toEqual({ coinsCredited: 35, xpAdded: 0 })
    expect(await earning.onGameResult(userId, input, { isTest: false })).toEqual({ coinsCredited: 35, xpAdded: 0 })
    expect(await earning.onGameResult(userId, { ...input, key: 'RMFND2' }, { isTest: true })).toEqual({ coinsCredited: 0, xpAdded: 0 })
    const rows = await t.db.query<{ source: string; source_id: string; description: string; amount: number }>(
      `select source, source_id, description, amount from coin_ledger where user_id = $1 and source = 'benteng_win'`,
      [userId],
    )
    expect(rows).toEqual([{ source: 'benteng_win', source_id: 'game:RMFND1', description: 'Juara Benteng Ilmu!', amount: 35 }])
    expect(gameRow('mathrace', 'play', { detail: { rank: 2 } })).toEqual({ source: 'mathrace_play', description: '#2 Perlumbaan Matematik' })
  })

  it('maps room subjects to the curriculum and grades to levels', async () => {
    const subjects = t.app.get(GameSubjects, { strict: false })
    expect(ROOM_SUBJECT_CODES).toEqual({ MATEMATIK: 'MATH', BAHASA_MELAYU: 'BM', BAHASA_INGGERIS: 'BI', SAINS: 'SCI', SEJARAH: 'SEJ' })
    for (const code of Object.keys(ROOM_SUBJECT_CODES) as (keyof typeof ROOM_SUBJECT_CODES)[]) {
      const [row] = await t.db.query<{ id: string }>(`select id::text from subjects where code = $1`, [ROOM_SUBJECT_CODES[code]])
      expect(await subjects.subjectId(code), code).toBe((row as { id: string }).id)
    }
    const [t4] = await t.db.query<{ id: string }>(`select id::text from education_levels where code = 'T4'`)
    expect(await subjects.levelIdOfGrade(10)).toBe((t4 as { id: string }).id)
    expect(await subjects.levelIdOfEnum('TINGKATAN_4')).toBe((t4 as { id: string }).id)
    expect(await subjects.levelIdOfGrade(0)).toBeNull()
    expect(await subjects.levelIdOfEnum('NOPE')).toBeNull()
  })

  it('grade, name and week helpers', () => {
    expect(gradeOfEnum('DARJAH_4')).toBe(4)
    expect(gradeOfEnum('TINGKATAN_2')).toBe(8)
    expect(gradeOfEnum('TINGKATAN_6')).toBeNull()
    expect(gradeOfEnum(4)).toBeNull()
    expect(enumOfGrade(1)).toBe('DARJAH_1')
    expect(enumOfGrade(11)).toBe('TINGKATAN_5')
    expect(enumOfGrade(12)).toBeNull()
    expect(enumOfGrade(null)).toBeNull()
    expect(gradeName(6)).toBe('Darjah 6')
    expect(gradeName(7)).toBe('Tingkatan 1')
    expect(gradeName(null)).toBeNull()
    expect(levelCodeOfGrade(3)).toBe('D3')
    expect(levelCodeOfGrade(11)).toBe('T5')
    const room = { gradeLevel: 'DARJAH_4', matchMode: 'same_grade', gradeMin: null, gradeMax: null }
    expect(gradeFits(room, 4)).toBe(true)
    expect(gradeFits(room, 5)).toBe(false)
    expect(gradeFits(room, null)).toBe(true)
    expect(gradeFits({ ...room, matchMode: 'same_level' }, 6)).toBe(true)
    expect(gradeFits({ ...room, matchMode: 'same_level' }, 7)).toBe(false)
    expect(gradeFits({ ...room, matchMode: 'custom', gradeMin: 3, gradeMax: 5 }, 5)).toBe(true)
    expect(gradeFits({ ...room, matchMode: 'custom', gradeMin: 3, gradeMax: 5 }, 6)).toBe(false)
    expect(truncateName('Murid Contoh Alfa Beta')).toBe('Murid Contoh Al...')
    expect(truncateName('Murid Demo')).toBe('Murid Demo')
    expect(initialsOf('murid contoh alfa')).toBe('MC')
    expect(kadarOf(1, 3)).toBe(33)
    expect(kadarOf(0, 0)).toBe(0)
    // Monday 19 Oct 2026 09:00 +08:00 -> week Mon 19 .. Sun 25 Oct.
    const week = mytWeek(new Date('2026-10-21T15:00:00+08:00'))
    expect(week.weekStart).toBe('2026-10-19')
    expect(week.weekEnd).toBe('2026-10-25')
    expect(week.endsAtStamp).toBe('2026-10-25T23:59:59.000+08:00')
    expect(startOfMytWeek(new Date('2026-10-25T23:00:00+08:00')).toISOString()).toBe('2026-10-18T16:00:00.000Z')
  })

  it('serves keyless questions and keeps the key server-side', async () => {
    const inserted = await insertMcqQuestions(t.db, { subject: 'SCI', level: 'T4', count: 6, prefix: 'FND', difficultyTp: (i) => (i % 3) + 1 })
    await insertMcqQuestions(t.db, { subject: 'SCI', level: 'T4', count: 2, prefix: 'FNDD', status: 'draft' })
    const [sci] = await t.db.query<{ id: string }>(`select id::text from subjects where code = 'SCI'`)
    const [t4] = await t.db.query<{ id: string }>(`select id::text from education_levels where code = 'T4'`)
    const gq = t.app.get(GameQuestions, { strict: false })
    const served = await gq.sample({ subjectId: (sci as { id: string }).id, educationLevelId: (t4 as { id: string }).id, difficultyTp: 1 }, 10, prngStream('games:test:foundation'))
    expect(served.length).toBeGreaterThan(0)
    const oracle = new Map(inserted.map((q) => [q.id, q]))
    for (const s of served) {
      const parsed = GamesKeylessQuestionSchema.parse(s.question) // strict: any key field would fail
      expect(Object.keys(parsed).sort()).toEqual(['id', 'options', 'text'])
      expect(JSON.stringify(s.question)).not.toMatch(/key|correct|answer|explanation/i)
      const src = oracle.get(s.question.id)
      expect(src, 'a draft or foreign question was served').toBeDefined()
      expect(s.keyIndex).toBe(src?.keyIndex)
      expect(s.keyText).toBe(src?.optionTexts[src.keyIndex])
      expect(s.question.options.map((o) => o.id)).toEqual([0, 1, 2, 3])
    }
    const all = await gq.sample({ subjectId: (sci as { id: string }).id, educationLevelId: (t4 as { id: string }).id }, 100, prngStream('games:test:foundation'))
    expect(all.map((s) => s.question.id).sort()).toEqual(expect.arrayContaining(inserted.map((q) => q.id)))
    // same stream, same draw
    const again = await gq.sample({ subjectId: (sci as { id: string }).id, educationLevelId: (t4 as { id: string }).id }, 100, prngStream('games:test:foundation'))
    expect(again.map((s) => s.question.id)).toEqual(all.map((s) => s.question.id))
    expect(await gq.eligibleCount({ subjectId: (sci as { id: string }).id, educationLevelId: (t4 as { id: string }).id })).toBeGreaterThanOrEqual(6)
  })

  it('the default bot pool picks a fitting classmate of the host, deterministically', async () => {
    const [host] = await t.db.query<{ id: string }>(`select id::text from users where email = $1`, [ACCOUNTS.student])
    const hostId = (host as { id: string }).id
    const input = { hostId, fits: (g: number | null) => g !== null && g >= 7, exclude: [hostId], stream: 'games:bot:TESTRM:1' }
    const a = await t.ports.botPool.pick(input)
    const b = await t.ports.botPool.pick(input)
    expect(a).not.toBeNull()
    expect(a).toEqual(b)
    expect(a?.id).not.toBe(hostId)
    expect(a?.grade).toBeGreaterThanOrEqual(7)
    expect(await t.ports.botPool.pick({ ...input, fits: () => false })).toBeNull()
    const users = t.app.get(GameUsers, { strict: false })
    const profile = await users.get(hostId)
    expect(Object.keys(profile ?? {}).sort()).toEqual(['grade', 'id', 'isPupil', 'name', 'schoolId'])
  })

  it('boots with GamesModule registered, answering 401 without a session on an unknown games path', async () => {
    const res = await t.http().get('/api/games/hub')
    // No controller yet (agents B, C, D add them): the app answers the standard 401 before routing, or 404.
    expect([401, 404]).toContain(res.status)
    const student = await loginAs(t, ACCOUNTS.student)
    expect(student.userId).toBeTruthy()
  })
})
