import { GamesRoomCodeResultSchema, GAMES_MESSAGES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ACCOUNTS,
  bootGamesApp,
  expectError,
  loginAs,
  parseData,
  type Client,
  type GamesTestApp,
} from '../helpers'
import {
  FORM,
  P,
  PB_FORM,
  createRoom,
  demo001Students,
  ListBots,
  parseRoom,
  roomOf,
  userId,
} from './support'

const M = GAMES_MESSAGES

describe('create, join and view a room (M16-24, M16-25, M16-26)', () => {
  let t: GamesTestApp
  let student: Client
  let student2: Client
  let maju: Client
  let teacher: Client
  let admin: Client
  let bots: ListBots

  beforeAll(async () => {
    t = await bootGamesApp()
    student = await loginAs(t, ACCOUNTS.student)
    student2 = await loginAs(t, ACCOUNTS.student2)
    maju = await loginAs(t, ACCOUNTS.studentMaju)
    teacher = await loginAs(t, ACCOUNTS.teacher)
    admin = await loginAs(t, ACCOUNTS.admin)
    const kids = await demo001Students(t.db)
    bots = new ListBots(kids.map((k) => ({ id: k.id, name: k.name, grade: k.grade })))
    t.ports.provideBotPool(bots)
  })
  afterAll(async () => {
    await t.close()
  })

  describe('create validation (V-M16-01..05): the first failing field, same top-level message', () => {
    const cases: [string, string, object, string, string][] = [
      ['no body at all', 'perang-fakta', {}, 'subject', M.roomSubject],
      [
        'unknown subject',
        'perang-fakta',
        { ...FORM, subject: 'GEOGRAFI' },
        'subject',
        M.roomSubject,
      ],
      [
        'Papan Bijak refuses SEJARAH',
        'papan-bijak',
        { ...PB_FORM, subject: 'SEJARAH' },
        'subject',
        M.roomSubject,
      ],
      ['no grade level', 'perang-fakta', { subject: 'SAINS' }, 'grade_level', M.roomGradeLevel],
      [
        'bad grade level',
        'perang-fakta',
        { ...FORM, grade_level: 'DARJAH_7' },
        'grade_level',
        M.roomGradeLevel,
      ],
      ['darjah grade level (secondary-only)', 'perang-fakta', { ...FORM, grade_level: 'DARJAH_4', match_mode: 'same_level' }, 'grade_level', M.roomGradeLevel],
      [
        'no match mode',
        'perang-fakta',
        { subject: 'SAINS', grade_level: 'DARJAH_1' },
        'match_mode',
        M.roomRange,
      ],
      [
        'custom is for Papan Bijak only',
        'benteng-ilmu',
        { ...FORM, match_mode: 'custom', grade_min: 1, grade_max: 5 },
        'match_mode',
        M.roomRange,
      ],
      [
        'custom without a range',
        'papan-bijak',
        { ...PB_FORM, match_mode: 'custom' },
        'grade_min',
        M.roomRange,
      ],
      [
        'custom min above max',
        'papan-bijak',
        { ...PB_FORM, match_mode: 'custom', grade_min: 8, grade_max: 3 },
        'grade_min',
        M.roomRange,
      ],
      [
        'custom range outside 1..11',
        'papan-bijak',
        { ...PB_FORM, match_mode: 'custom', grade_min: 0, grade_max: 3 },
        'grade_min',
        M.roomRange,
      ],
      [
        'custom range not integer',
        'papan-bijak',
        { ...PB_FORM, match_mode: 'custom', grade_min: 1.5, grade_max: 3 },
        'grade_min',
        M.roomRange,
      ],
      [
        'custom max above 11',
        'papan-bijak',
        { ...PB_FORM, match_mode: 'custom', grade_min: 2, grade_max: 12 },
        'grade_min',
        M.roomRange,
      ],
      ['Papan Bijak needs max_players', 'papan-bijak', FORM, 'max_players', M.roomMaxPlayers],
      [
        'max_players 1',
        'papan-bijak',
        { ...PB_FORM, max_players: 1 },
        'max_players',
        M.roomMaxPlayers,
      ],
      [
        'max_players 7',
        'papan-bijak',
        { ...PB_FORM, max_players: 7 },
        'max_players',
        M.roomMaxPlayers,
      ],
      [
        'max_players fraction',
        'papan-bijak',
        { ...PB_FORM, max_players: 2.5 },
        'max_players',
        M.roomMaxPlayers,
      ],
      [
        'max_players text',
        'papan-bijak',
        { ...PB_FORM, max_players: '4' },
        'max_players',
        M.roomMaxPlayers,
      ],
      [
        'subject is reported before max_players',
        'papan-bijak',
        { subject: 'X', grade_level: 'DARJAH_1', match_mode: 'same_grade', max_players: 99 },
        'subject',
        M.roomSubject,
      ],
      [
        'range is reported before max_players',
        'papan-bijak',
        { ...PB_FORM, match_mode: 'custom', grade_min: 9, grade_max: 2, max_players: 99 },
        'grade_min',
        M.roomRange,
      ],
    ]
    for (const [name, game, body, field, message] of cases) {
      it(name, async () => {
        const res = await student.post(P(game), body)
        const err = expectError(res, 'VALIDATION_ERROR', message)
        expect(err.fields).toEqual({ [field]: message })
      })
    }

    it('an unknown game is 404 (before any body check) and non-JSON bodies are 422 field errors', async () => {
      expectError(await student.post(P('catur'), {}), 'NOT_FOUND', M.gameNotFound)
      expectError(
        await student.post(P('perang-fakta'), undefined),
        'VALIDATION_ERROR',
        M.roomSubject,
      )
      expectError(
        await student.post(P('perang-fakta'), [] as unknown as object),
        'VALIDATION_ERROR',
        M.roomSubject,
      )
    })
  })

  describe('create', () => {
    it('201 { code } for every game; host is the first human player; room waiting; no-store; fixed maximums', async () => {
      const expected: Record<string, number> = {
        'perang-fakta': 6,
        'benteng-ilmu': 2,
        'perlumbaan-matematik': 4,
        'kuiz-relay': 8,
        'teka-silang-kata': 2,
      }
      for (const [game, max] of Object.entries(expected)) {
        const res = await student.post(P(game), {
          ...FORM,
          match_mode: 'same_level',
          max_players: 5,
        }) // max_players is ignored
        expect(res.status).toBe(201)
        expect(res.headers['cache-control']).toBe('no-store')
        const { code } = parseData(res, GamesRoomCodeResultSchema)
        expect(code).toMatch(/^[A-Z0-9]{6}$/)
        const room = await roomOf(t.db, code)
        expect(room).toMatchObject({
          game,
          status: 'waiting',
          max_players: max,
          subject: 'MATEMATIK',
          grade_level: 'TINGKATAN_4',
          match_mode: 'same_level',
          is_test: false,
          state: { seed: expect.stringMatching(/^[0-9a-f]{32}$/) },
          settled_at: null,
        })
        expect(room.grade_min).toBeNull()
        const players = await t.db.query(
          'select user_id::text, is_bot, is_test from game_room_players where room_code = $1',
          [code],
        )
        expect(players).toEqual([{ user_id: student.userId, is_bot: false, is_test: false }])
        expect(String(room.host_id)).toBe(student.userId)
      }
    })

    it('Papan Bijak takes max_players and the custom grade range; SEJARAH is allowed for the other games', async () => {
      const code = await createRoom(student, 'papan-bijak', {
        ...PB_FORM,
        match_mode: 'custom',
        grade_min: 8,
        grade_max: 11,
        max_players: 6,
      })
      expect(await roomOf(t.db, code)).toMatchObject({
        max_players: 6,
        match_mode: 'custom',
        grade_min: 8,
        grade_max: 11,
      })
      const sej = await createRoom(student, 'kuiz-relay', { ...FORM, subject: 'SEJARAH' })
      expect(await roomOf(t.db, sej)).toMatchObject({ subject: 'SEJARAH' })
      const same = await createRoom(student, 'papan-bijak', {
        ...PB_FORM,
        grade_min: 3,
        grade_max: 1,
      }) // ignored unless custom
      expect(await roomOf(t.db, same)).toMatchObject({ grade_min: null, grade_max: null })
    })

    it('codes are drawn from a named stream: distinct codes for distinct rooms', async () => {
      const seen = new Set<string>()
      for (let i = 0; i < 12; i++) seen.add(await createRoom(student, 'perang-fakta'))
      expect(seen.size).toBe(12)
    })

    it('Mod Pelajar stamps room and player rows is_test', async () => {
      const mod = await loginAs(t, ACCOUNTS.admin, { mod: true })
      const code = await createRoom(mod, 'perang-fakta')
      expect(await roomOf(t.db, code)).toMatchObject({ is_test: true })
      expect(
        await t.db.query('select is_test from game_room_players where room_code = $1', [code]),
      ).toEqual([{ is_test: true }])
    })

    it('any signed-in role may create (teacher, admin)', async () => {
      expect((await teacher.post(P('perang-fakta'), FORM)).status).toBe(201)
      expect((await admin.post(P('perang-fakta'), FORM)).status).toBe(201)
    })
  })

  describe('join', () => {
    it('joins a waiting room; the code is trimmed and upper-cased; already a player is 200 without a second row', async () => {
      const code = await createRoom(student, 'perang-fakta')
      const res = await student2.post(P('perang-fakta', undefined, '/join'), {
        room_code: `  ${code.toLowerCase()} `,
      })
      expect(res.status).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      expect(parseData(res, GamesRoomCodeResultSchema)).toEqual({ code })
      const again = await student2.post(P('perang-fakta', undefined, '/join'), { room_code: code })
      expect(parseData(again, GamesRoomCodeResultSchema)).toEqual({ code })
      const host = await student.post(P('perang-fakta', undefined, '/join'), { room_code: code })
      expect(parseData(host, GamesRoomCodeResultSchema)).toEqual({ code })
      const rows = await t.db.query(
        'select user_id::text, is_bot from game_room_players where room_code = $1 order by id',
        [code],
      )
      expect(rows).toEqual([
        { user_id: student.userId, is_bot: false },
        { user_id: student2.userId, is_bot: false },
      ])
    })

    it('every refusal is the same 404 "Bilik tidak dijumpai."', async () => {
      const code = await createRoom(student, 'perang-fakta')
      const waitingBenteng = await createRoom(student, 'benteng-ilmu')
      const started = await createRoom(student, 'perang-fakta')
      await t.db.query(`update game_rooms set status = 'playing' where code = $1`, [started])
      const joinBody = (room_code: unknown) => ({ room_code })
      const attempts: [string, string, unknown][] = [
        ['blank', 'perang-fakta', ''],
        ['spaces', 'perang-fakta', '   '],
        ['missing', 'perang-fakta', undefined],
        ['not a string', 'perang-fakta', 123456],
        ['malformed', 'perang-fakta', "'; drop table game_rooms; --"],
        ['unknown', 'perang-fakta', 'ZZZZZZ'],
        ['other game', 'benteng-ilmu', code],
        ['other game 2', 'perang-fakta', waitingBenteng],
        ['not waiting', 'perang-fakta', started],
      ]
      for (const [name, game, value] of attempts) {
        const res = await student2.post(P(game, undefined, '/join'), joinBody(value))
        expectError(res, 'NOT_FOUND', M.roomNotFound)
        expect(res.status, name).toBe(404)
      }
      expectError(
        await student2.post(P('perang-fakta', undefined, '/join'), undefined),
        'NOT_FOUND',
        M.roomNotFound,
      )
      expectError(
        await student2.post(P('catur', undefined, '/join'), { room_code: code }),
        'NOT_FOUND',
        M.gameNotFound,
      )
    })

    it('grade rules: same_grade equal grade, same_level same side, custom inside the range', async () => {
      // pelajar2 is grade 10 (T4), pelajarmaju grade 11 (T5)
      const sameGrade = await createRoom(student, 'perang-fakta', {
        ...FORM,
        match_mode: 'same_grade',
      })
      expectError(
        await maju.post(P('perang-fakta', undefined, '/join'), { room_code: sameGrade }),
        'NOT_FOUND',
        M.roomNotFound,
      )
      expect(
        (await student2.post(P('perang-fakta', undefined, '/join'), { room_code: sameGrade }))
          .status,
      ).toBe(200)

      const sameLevel = await createRoom(student, 'perang-fakta', {
        ...FORM,
        match_mode: 'same_level',
      })
      expect(
        (await maju.post(P('perang-fakta', undefined, '/join'), { room_code: sameLevel })).status,
      ).toBe(200)
      // Secondary-only (2026-10-29): a Darjah room can no longer be created (see the refusal row in the validation table).

      const custom = await createRoom(student, 'papan-bijak', {
        ...PB_FORM,
        match_mode: 'custom',
        grade_min: 9,
        grade_max: 10,
      })
      expectError(
        await maju.post(P('papan-bijak', undefined, '/join'), { room_code: custom }),
        'NOT_FOUND',
        M.roomNotFound,
      )
      expect(
        (await student2.post(P('papan-bijak', undefined, '/join'), { room_code: custom })).status,
      ).toBe(200)

      // a caller without a grade always fits
      const open = await createRoom(student, 'perang-fakta', {
        ...FORM,
        grade_level: 'TINGKATAN_4',
        match_mode: 'same_grade',
      })
      expect(
        (await teacher.post(P('perang-fakta', undefined, '/join'), { room_code: open })).status,
      ).toBe(200)
    })

    it('a full room refuses (404)', async () => {
      const code = await createRoom(student, 'benteng-ilmu', { ...FORM, match_mode: 'same_level' })
      expect(
        (await student2.post(P('benteng-ilmu', undefined, '/join'), { room_code: code })).status,
      ).toBe(200)
      expectError(
        await maju.post(P('benteng-ilmu', undefined, '/join'), { room_code: code }),
        'NOT_FOUND',
        M.roomNotFound,
      )
    })

    it('concurrent joins never exceed max_players (row lock)', async () => {
      const kids = await demo001Students(t.db)
      const clients = await Promise.all([
        student2,
        maju,
        ...kids.slice(0, 5).map((k) => loginAs(t, k.email)),
      ])
      const roomSecondary = (game: string, max: number) =>
        createRoom(
          student,
          game,
          game === 'papan-bijak'
            ? { ...PB_FORM, match_mode: 'same_level', max_players: max }
            : { ...FORM, match_mode: 'same_level' },
        )
      for (const [game, max] of [
        ['benteng-ilmu', 2],
        ['papan-bijak', 3],
      ] as const) {
        const code = await roomSecondary(game, max)
        const results = await Promise.all(
          clients.map((c) => c.post(P(game, undefined, '/join'), { room_code: code })),
        )
        const ok = results.filter((r) => r.status === 200).length
        const refused = results.filter((r) => r.status === 404)
        expect(ok).toBe(max - 1)
        expect(refused).toHaveLength(clients.length - ok)
        for (const r of refused) expectError(r, 'NOT_FOUND', M.roomNotFound)
        const rows = await t.db.query<{ n: string }>(
          'select count(*)::text as n from game_room_players where room_code = $1',
          [code],
        )
        expect(Number(rows[0]?.n)).toBe(max)
      }
    })

    it('no mixed rooms: a test caller cannot join a normal room and a normal caller cannot join a test room (404)', async () => {
      const mod = await loginAs(t, ACCOUNTS.schoolAdmin, { mod: true })
      const normal = await createRoom(student, 'perang-fakta', {
        ...FORM,
        match_mode: 'same_level',
      })
      expectError(
        await mod.post(P('perang-fakta', undefined, '/join'), { room_code: normal }),
        'NOT_FOUND',
        M.roomNotFound,
      )
      const testRoom = await createRoom(mod, 'perang-fakta', { ...FORM, match_mode: 'same_level' })
      expectError(
        await student2.post(P('perang-fakta', undefined, '/join'), { room_code: testRoom }),
        'NOT_FOUND',
        M.roomNotFound,
      )
      const other = await loginAs(t, ACCOUNTS.admin, { mod: true })
      expect(
        (await other.post(P('perang-fakta', undefined, '/join'), { room_code: testRoom })).status,
      ).toBe(200)
      expect(
        await t.db.query(
          'select is_test from game_room_players where room_code = $1 and user_id = $2',
          [testRoom, other.userId],
        ),
      ).toEqual([{ is_test: true }])
      expect(
        await t.db.query('select user_id::text from game_room_players where room_code = $1', [
          normal,
        ]),
      ).toEqual([{ user_id: student.userId }])
    })
  })

  describe('view and the waiting-room simulation', () => {
    it('only players see the room (404 for others, unknown, other game, malformed code)', async () => {
      const code = await createRoom(student, 'perang-fakta')
      expect((await student.get(P('perang-fakta', code))).status).toBe(200)
      expectError(await student2.get(P('perang-fakta', code)), 'NOT_FOUND', M.roomNotFound)
      expectError(await student.get(P('benteng-ilmu', code)), 'NOT_FOUND', M.roomNotFound)
      expectError(await student.get(P('perang-fakta', 'ZZZZZZ')), 'NOT_FOUND', M.roomNotFound)
      expectError(await student.get(P('perang-fakta', 'abc')), 'NOT_FOUND', M.roomNotFound)
      expectError(await student.get(P('perang-fakta', "x'; select 1")), 'NOT_FOUND', M.roomNotFound)
      expectError(await student.get(P('catur', code)), 'NOT_FOUND', M.gameNotFound)
      expect(
        (await student2.post(P('perang-fakta', undefined, '/join'), { room_code: code })).status,
      ).toBe(200)
      expect((await student2.get(P('perang-fakta', code))).status).toBe(200)
    })

    it('the room view shape: waiting, state null, no question, no-store, settings and display names only', async () => {
      const code = await createRoom(student, 'perang-fakta', {
        subject: 'SAINS',
        grade_level: 'TINGKATAN_4',
        match_mode: 'same_level',
      })
      await student2.post(P('perang-fakta', undefined, '/join'), { room_code: code })
      const res = await student.get(P('perang-fakta', code))
      expect(res.headers['cache-control']).toBe('no-store')
      const room = parseRoom(res)
      expect(room).toMatchObject({
        code,
        game: 'perang-fakta',
        status: 'waiting',
        state: null,
        host: { id: student.userId, name: 'Murid Demo' },
        settings: {
          subject: 'SAINS',
          gradeLevel: 'TINGKATAN_4',
          matchMode: 'same_level',
          gradeMin: null,
          gradeMax: null,
          maxPlayers: 6,
          minPlayers: 2,
        },
      })
      expect(room.question).toBeUndefined()
      expect(room.result).toBeUndefined()
      expect(room.players.map((p) => [p.id, p.grade, p.points, p.isBot])).toEqual([
        [student.userId, 'Tingkatan 4', 0, false],
        [student2.userId, 'Tingkatan 4', 0, false],
      ])
      expect(JSON.stringify(res.body)).not.toMatch(/@demo|email|phone|password/i)
    })

    it('a host poll below the minimum adds exactly one bot per poll; a non-host poll or a full minimum adds none', async () => {
      const code = await createRoom(student, 'kuiz-relay') // minimum 4
      const sizes: number[] = []
      for (let i = 0; i < 5; i++) {
        sizes.push(parseRoom(await student.get(P('kuiz-relay', code))).players.length)
      }
      // poll 1 sees 2 players (one bot added on that poll) ... the 4th poll reaches 4; further polls add none
      expect(sizes).toEqual([2, 3, 4, 4, 4])
      const view = parseRoom(await student.get(P('kuiz-relay', code)))
      expect(view.players.filter((p) => p.isBot)).toHaveLength(3)
      expect(view.players[0]).toMatchObject({ id: student.userId, isBot: false })
      const rows = await t.db.query(
        'select is_bot, is_test from game_room_players where room_code = $1 order by id',
        [code],
      )
      expect(rows.map((r) => r.is_bot)).toEqual([false, true, true, true])
    })

    it('a non-host player poll never adds a bot', async () => {
      const code = await createRoom(student, 'perang-fakta')
      await student2.post(P('perang-fakta', undefined, '/join'), { room_code: code })
      // the room already has the minimum (2): not even the host adds one
      parseRoom(await student.get(P('perang-fakta', code)))
      parseRoom(await student2.get(P('perang-fakta', code)))
      expect(
        (await t.db.query('select 1 from game_room_players where room_code = $1', [code])).length,
      ).toBe(2)
      const solo = await createRoom(student, 'benteng-ilmu')
      const before = (
        await t.db.query('select 1 from game_room_players where room_code = $1', [solo])
      ).length
      await student2.get(P('benteng-ilmu', solo)) // not a player: 404, no bot
      expect(
        (await t.db.query('select 1 from game_room_players where room_code = $1', [solo])).length,
      ).toBe(before)
    })

    it('bots fit the room grade when possible, are never the host or a present player, and bots of a test room are test rows', async () => {
      const code = await createRoom(student, 'perang-fakta')
      parseRoom(await student.get(P('perang-fakta', code)))
      const pick = bots.picks.at(-1)
      expect(pick?.hostId).toBe(student.userId)
      expect(pick?.exclude).toEqual([student.userId])
      expect(pick?.stream).toMatch(new RegExp(`^m16:room:${code}:[0-9a-f]{32}:bot:1$`))
      const mod = await loginAs(t, ACCOUNTS.admin, { mod: true })
      const testRoom = await createRoom(mod, 'perang-fakta')
      parseRoom(await mod.get(P('perang-fakta', testRoom)))
      expect(
        await t.db.query(
          'select is_bot, is_test from game_room_players where room_code = $1 order by id',
          [testRoom],
        ),
      ).toEqual([
        { is_bot: false, is_test: true },
        { is_bot: true, is_test: true },
      ])
    })

    it('with no bot available the poll adds none (no error)', async () => {
      const code = await createRoom(student, 'perang-fakta')
      const saved = bots.list.splice(0)
      try {
        expect(parseRoom(await student.get(P('perang-fakta', code))).players).toHaveLength(1)
      } finally {
        bots.list.push(...saved)
      }
    })

    it('the secret seed never leaves the server; codes are crypto-random A-Z0-9', async () => {
      const code = await createRoom(student, 'perang-fakta')
      expect(code).toMatch(/^[A-Z0-9]{6}$/)
      const seed = (
        await t.db.query<{ state: { seed: string } }>(
          'select state from game_rooms where code = $1',
          [code],
        )
      )[0]?.state.seed as string
      expect(seed).toMatch(/^[0-9a-f]{32}$/)
      const waiting = await student.get(P('perang-fakta', code))
      expect(JSON.stringify(waiting.body)).not.toContain(seed)
      expect(parseRoom(waiting).state).toBeNull()
      const other = await createRoom(student, 'perang-fakta')
      expect(
        (
          await t.db.query<{ state: { seed: string } }>(
            'select state from game_rooms where code = $1',
            [other],
          )
        )[0]?.state.seed,
      ).not.toBe(seed)
    })

    it('the user ids in the room view are decimal strings of the owner users', async () => {
      const code = await createRoom(student, 'perang-fakta')
      const room = parseRoom(await student.get(P('perang-fakta', code)))
      expect(room.host.id).toBe(await userId(t.db, ACCOUNTS.student))
    })
  })
})
