import {
  GamesAdminOverviewSchema,
  GamesAdminSettingsResultSchema,
  GAMES_MESSAGES,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ACCOUNTS,
  bootGamesApp,
  expectCsrfInvalid,
  expectError,
  loginAs,
  parseData,
  type Client,
  type GamesTestApp,
} from '../helpers'
import { FORM, P, createRoom, insertShortMcqs, parseRoom } from './support'

const M = GAMES_MESSAGES

describe('admin game settings (M16-51, M16-52)', () => {
  let t: GamesTestApp
  let admin: Client
  let student: Client

  beforeAll(async () => {
    t = await bootGamesApp()
    admin = await loginAs(t, ACCOUNTS.admin)
    student = await loginAs(t, ACCOUNTS.student)
  })
  afterAll(async () => {
    await t.close()
  })

  it('GET: zero statistics and the default 35 quiz tiles, parsed by the contract', async () => {
    const res = await admin.get('/api/admin/games')
    expect(parseData(res, GamesAdminOverviewSchema)).toEqual({
      stats: { rooms: 0, playing: 0, finished: 0, players: 0 },
      settings: { boardgameQuizTiles: 35 },
    })
  })

  it('GET: counts rooms by status and distinct players; rooms of Mod Pelajar (test) actors are excluded', async () => {
    const a = await createRoom(student, 'perang-fakta')
    const b = await createRoom(student, 'benteng-ilmu')
    const c = await createRoom(student, 'perang-fakta')
    await t.db.query(`update game_rooms set status = 'playing' where code = $1`, [a])
    await t.db.query(`update game_rooms set status = 'finished' where code = $1`, [b])
    const s2 = await loginAs(t, ACCOUNTS.student2)
    await s2.post(P('perang-fakta', undefined, '/join'), { room_code: c })
    const mod = await loginAs(t, ACCOUNTS.schoolAdmin, { mod: true })
    const testRoom = await createRoom(mod, 'perang-fakta')
    await t.db.query(`update game_rooms set status = 'playing' where code = $1`, [testRoom])
    const stats = parseData(await admin.get('/api/admin/games'), GamesAdminOverviewSchema).stats
    expect(stats).toEqual({ rooms: 3, playing: 1, finished: 1, players: 2 })
  })

  it('PUT: saves 0..38 and returns the value; GET and the database follow', async () => {
    for (const v of [0, 38, 12]) {
      const res = await admin.put('/api/admin/games/settings', { boardgame_quiz_tiles: v })
      expect(res.status).toBe(200)
      expect(parseData(res, GamesAdminSettingsResultSchema)).toEqual({ boardgameQuizTiles: v })
      expect(
        parseData(await admin.get('/api/admin/games'), GamesAdminOverviewSchema).settings,
      ).toEqual({ boardgameQuizTiles: v })
    }
    expect(await t.db.query('select id, boardgame_quiz_tiles from game_settings')).toEqual([
      { id: 1, boardgame_quiz_tiles: 12 },
    ])
  })

  it('PUT: 422 "Nilai mesti antara 0 dan 38." with fields.boardgame_quiz_tiles and the same top-level message', async () => {
    for (const body of [
      undefined,
      {},
      { boardgame_quiz_tiles: -1 },
      { boardgame_quiz_tiles: 39 },
      { boardgame_quiz_tiles: 1.5 },
      { boardgame_quiz_tiles: '5' },
      { boardgame_quiz_tiles: null },
      { boardgame_quiz_tiles: true },
    ]) {
      const err = expectError(
        await admin.put('/api/admin/games/settings', body),
        'VALIDATION_ERROR',
        M.quizTiles,
      )
      expect(err.fields).toEqual({ boardgame_quiz_tiles: M.quizTiles })
    }
    expect(
      parseData(await admin.get('/api/admin/games'), GamesAdminOverviewSchema).settings
        .boardgameQuizTiles,
    ).toBe(12)
  })

  it('the setting drives the Papan Bijak board of the next game (quiz tiles from game_settings)', async () => {
    await insertShortMcqs(t.db, { subject: 'MATH', level: 'T4', count: 45, prefix: 'AD' })
    for (const [tiles, plain] of [
      [0, 38],
      [38, 0],
      [20, 18],
    ] as const) {
      expect(
        (await admin.put('/api/admin/games/settings', { boardgame_quiz_tiles: tiles })).status,
      ).toBe(200)
      const code = await createRoom(student, 'papan-bijak', { ...FORM, max_players: 2 })
      await student.get(P('papan-bijak', code))
      const v = parseRoom(await student.post(P('papan-bijak', code, '/start')))
      const board = v.state?.board ?? []
      expect(board.filter((x) => x === 'quiz')).toHaveLength(tiles)
      expect(board.filter((x) => x === 'plain')).toHaveLength(plain)
    }
  })

  describe('guards', () => {
    it('no session: 401 on both routes', async () => {
      expectError(await t.http().get('/api/admin/games'), 'UNAUTHORIZED', 'Unauthenticated.')
      expectError(
        await t.http().put('/api/admin/games/settings').send({ boardgame_quiz_tiles: 3 }),
        'UNAUTHORIZED',
        'Unauthenticated.',
      )
    })

    for (const [name, email] of [
      ['student', ACCOUNTS.student],
      ['teacher', ACCOUNTS.teacher],
      ['school admin', ACCOUNTS.schoolAdmin],
      ['parent', 'ibubapa@demo.test'],
    ] as const) {
      it(`${name}: 403 "This action is unauthorized." on both routes, and nothing is written`, async () => {
        const c = await loginAs(t, email)
        expectError(await c.get('/api/admin/games'), 'FORBIDDEN', 'This action is unauthorized.')
        expectError(
          await c.put('/api/admin/games/settings', { boardgame_quiz_tiles: 1 }),
          'FORBIDDEN',
          'This action is unauthorized.',
        )
        expect(
          parseData(await admin.get('/api/admin/games'), GamesAdminOverviewSchema).settings
            .boardgameQuizTiles,
        ).toBe(20)
      })
    }

    it('an admin in Mod Pelajar acts as a student: 403', async () => {
      const mod = await loginAs(t, ACCOUNTS.admin, { mod: true })
      expectError(await mod.get('/api/admin/games'), 'FORBIDDEN', 'This action is unauthorized.')
    })

    it('PUT without the CSRF token is CSRF_INVALID', async () => {
      expectCsrfInvalid(
        await admin.noCsrf.put('/api/admin/games/settings', { boardgame_quiz_tiles: 3 }),
      )
    })
  })
})
