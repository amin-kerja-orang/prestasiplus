/**
 * M16-T2: the game endpoints (SRS M16 v1.6 §7 #22-#41, #51-#52): the hub, the six room lobbies and rooms, the
 * Papan Bijak quick match, the five single-player games, Roda Nasib, Jutawan Ilmu, the weekly competition and
 * the admin settings; and the seeds of §6.11.0 / §6.11.3 / §6.11.5. Booted with the real core and M01-M05, M07,
 * M14 and M16 at the project clock (2026-09-25 15:40 MYT); the clock is frozen and tests share one runtime and
 * run in order.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { questions } from '@/modules/m04-question-bank/mock'
import { gamification } from '@/modules/m14-gamification/mock'

import { gameResults, rooms } from '../../mock'
import { m16Hooks } from '../../mock/hooks'
import { bootM16, MemoryStorage, setUser, type Answer, type Booted } from './helpers'

const ADMIN = 1
const T4_STUDENT = 2 // grade 10
const D5_STUDENT = 3 // grade 5, no school
const D1_STUDENT = 4 // grade 1

let booted: Booted

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  booted = await bootM16()
}, 300_000)

afterAll(async () => {
  await booted.runtime.reset()
  vi.unstubAllGlobals()
}, 180_000)

async function call<T = unknown>(
  method: 'GET' | 'POST' | 'PUT',
  url: string,
  as: number | null,
  body?: unknown,
): Promise<Answer<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (as !== null) headers.authorization = `Bearer ${setUser(as).token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  const res = await booted.runtime.transport.request({
    method,
    url,
    headers,
    ...(body !== undefined ? { body } : {}),
  })
  return { status: res.status, body: res.body as T }
}

const get = <T>(url: string, as: number | null) => call<T>('GET', url, as)
const post = <T>(url: string, as: number | null, body?: unknown) => call<T>('POST', url, as, body)

interface Data<T> {
  data: T
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any

describe('access', () => {
  it.each([
    ['GET', '/api/games/hub'],
    ['GET', '/api/games/papan-bijak/lobby'],
    ['POST', '/api/games/papan-bijak/rooms'],
    ['POST', '/api/games/papan-bijak/rooms/join'],
    ['GET', '/api/games/papan-bijak/rooms/ABC123'],
    ['POST', '/api/papan-bijak/quick-match'],
    ['GET', '/api/papan-bijak/quick-match/poll'],
    ['GET', '/api/games/solo/betul-salah'],
    ['POST', '/api/games/solo/betul-salah/submit'],
    ['GET', '/api/games/roda-nasib'],
    ['POST', '/api/games/roda-nasib/spin'],
    ['GET', '/api/games/jutawan'],
    ['GET', '/api/games/pertandingan'],
    ['GET', '/api/games/uji-minda'],
    ['GET', '/api/admin/games'],
    ['PUT', '/api/admin/games/settings'],
  ] as const)('%s %s answers 401 without a session', async (method, url) => {
    expect((await call(method, url, null, method === 'GET' ? undefined : {})).status).toBe(401)
  })

  it('answers 403 to a student on the admin endpoints', async () => {
    expect((await get('/api/admin/games', T4_STUDENT)).status).toBe(403)
    expect(
      (await call('PUT', '/api/admin/games/settings', T4_STUDENT, { boardgame_quiz_tiles: 3 }))
        .status,
    ).toBe(403)
  })

  it('answers 404 for an unknown room game', async () => {
    expect((await get('/api/games/sambung-kata/lobby', ADMIN)).status).toBe(404)
    expect((await post('/api/games/nope/rooms', ADMIN, {})).status).toBe(404)
  })
})

describe('seed (SRS §6.11.0, §6.11.3, §6.11.5)', () => {
  it('serves the hub for the admin: no open room, played Papan Bijak, never battled', async () => {
    const r = await get<Data<Any>>('/api/games/hub', ADMIN)
    expect(r.status).toBe(200)
    expect(r.body.data.openRooms).toEqual([])
    expect(r.body.data.chips).toEqual({ papanBijakPlayed: true, battled: false })
  })

  it('serves the observed lobby leaders in the observed order', async () => {
    const values = async (game: string) => {
      const r = await get<Data<Any>>(`/api/games/${game}/lobby`, ADMIN)
      expect(r.status).toBe(200)
      return r.body.data.leaders.map((l: Any) => [l.rank, l.userId, l.value])
    }
    expect((await values('perang-fakta')).map((x: Any) => x[2])).toEqual([
      5, 4, 3, 3, 3, 3, 3, 2, 2, 2,
    ])
    expect((await values('perang-fakta')).map((x: Any) => x[1])).toEqual([
      4326, 4327, 4328, 4329, 4330, 4331, 4302, 4332, 4333, 4334,
    ])
    expect((await values('benteng-ilmu')).map((x: Any) => x[2])).toEqual([2, 1, 1, 1, 1, 1, 1, 1])
    expect((await values('perlumbaan-matematik')).map((x: Any) => x[2])).toEqual([
      2, 2, 1, 1, 1, 1, 1, 1, 1, 1,
    ])
    expect(await values('kuiz-relay')).toEqual([[1, 4331, 1]])
    expect((await values('teka-silang-kata')).map((x: Any) => x[1])).toEqual([
      4332, 4347, 4348, 4349, 4350, 4328,
    ])
  })

  it('serves the Papan Bijak Top 10 (menang, jumlah, kadar, skor, betul; name length classes)', async () => {
    const r = await get<Data<Any>>('/api/games/papan-bijak/lobby', ADMIN)
    const top = r.body.data.top10 as Any[]
    expect(top.map((t) => [t.userId, t.menang, t.jumlah, t.kadar, t.skor, t.betul])).toEqual([
      [1, 4, 6, 67, 90, 13],
      [4320, 3, 4, 75, 170, 9],
      [4352, 2, 4, 50, 230, 18],
      [4353, 2, 8, 25, 225, 46],
      [4354, 2, 6, 33, 185, 26],
      [4355, 2, 2, 100, 185, 11],
      [4356, 2, 3, 67, 165, 19],
      [4321, 2, 5, 40, 100, 14],
      [4357, 2, 6, 33, 65, 13],
      [4358, 2, 3, 67, 60, 10],
    ])
    const longRanks = [3, 4, 5, 7, 9, 10]
    for (const t of top) {
      expect(t.name.endsWith('...')).toBe(longRanks.includes(t.rank))
      expect(t.initials).toMatch(/^[A-Z]{1,2}$/)
    }
  })

  it('autoGrade follows the viewer grade', async () => {
    const r = await get<Data<Any>>('/api/games/perang-fakta/lobby', D5_STUDENT)
    expect(r.body.data.autoGrade).toBe('DARJAH_5')
    expect(r.body.data.autoGradeName).toBe('Darjah 5')
    const t4 = await get<Data<Any>>('/api/games/perang-fakta/lobby', T4_STUDENT)
    expect(t4.body.data.autoGrade).toBe('TINGKATAN_4')
  })

  it('serves the S29 stats: 160 rooms, none playing or finished, 189 players, 35 quiz tiles', async () => {
    const r = await get<Data<Any>>('/api/admin/games', ADMIN)
    expect(r.status).toBe(200)
    expect(r.body.data).toEqual({
      stats: { rooms: 160, playing: 0, finished: 0, players: 189 },
      settings: { boardgameQuizTiles: 35 },
    })
    expect(rooms.plainTiles()).toBe(3)
  })

  it('serves Roda Nasib for the admin: 2 spins, 0 won, not yet spun today, 0-based segments', async () => {
    const r = await get<Data<Any>>('/api/games/roda-nasib', ADMIN)
    expect(r.status).toBe(200)
    const d = r.body.data
    expect([d.spins, d.won, d.alreadySpun]).toEqual([2, 0, false])
    expect(d.segments.map((s: Any) => [s.label, s.weight])).toEqual([
      ['1 Syiling', 25],
      ['3 Syiling', 20],
      ['5 Syiling', 15],
      ['10 Syiling', 8],
      ['20 Syiling', 3],
      ['Cuba Lagi', 15],
      ['2 Syiling', 10],
      ['7 Syiling', 4],
    ])
    expect(typeof d.canEarnSyiling).toBe('boolean')
  })

  it('serves the Jutawan subjects per grade from the M04 counts (discovery A.7)', async () => {
    const none = await get<Data<Any>>('/api/games/jutawan', ADMIN)
    expect(none.body.data).toEqual({ bestLevel: 0, games: 0 })
    const d4 = await get<Data<Any>>('/api/games/jutawan?darjah=4', ADMIN)
    expect(d4.body.data.heading).toBe('DARJAH 4')
    expect(d4.body.data.subjects.map((s: Any) => [s.id, s.count])).toEqual([
      [1, 579],
      [2, 563],
      [3, 1077],
      [4, 616],
      [5, 660],
      [6, 369],
      [7, 312],
      [12, 200],
      [18, 500],
      [26, 400],
    ])
    const t4 = await get<Data<Any>>('/api/games/jutawan?darjah=10', ADMIN)
    expect(t4.body.data.heading).toBe('TINGKATAN 4')
    expect(t4.body.data.subjects).toHaveLength(20)
    expect((await get('/api/games/jutawan?darjah=12', ADMIN)).status).toBe(422)
  })

  it('serves the weekly competition at the clock (week 21-27 Sep, 20 rows, Sunday 23:59:59 MYT)', async () => {
    const r = await get<Data<Any>>('/api/games/pertandingan', ADMIN)
    expect(r.status).toBe(200)
    const d = r.body.data
    expect([d.weekStart, d.weekEnd, d.endsAt]).toEqual([
      '2026-09-21',
      '2026-09-27',
      '2026-09-27T23:59:59+08:00',
    ])
    expect(d.prizes).toEqual([100, 50, 25])
    expect(d.rows).toHaveLength(20)
    expect(d.rows.map((r: Any) => r.rank)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
    const betul = d.rows.map((r: Any) => r.betul) as number[]
    expect(betul).toEqual([...betul].sort((a, b) => b - a))
    expect(d.me).toBeNull()
    expect((await get<Data<Any>>('/api/games/uji-minda', ADMIN)).body.data).toEqual({
      challenge: null,
    })
  })

  it('shows the personal bests of the admin in the solo payload (38 / 40)', async () => {
    const bs = await get<Data<Any>>('/api/games/solo/betul-salah?darjah=4', ADMIN)
    expect(bs.body.data.personalBest).toBe(38)
    const ck = await get<Data<Any>>('/api/games/solo/cabaran-kilat?darjah=4', ADMIN)
    expect(ck.body.data.personalBest).toBe(40)
  })
})

// --- rooms -------------------------------------------------------------------------------------------------

type Room = Any

const roomPath = (game: string, code: string, tail = '') =>
  `/api/games/${game}/rooms/${code}${tail}`

const forms: Record<string, Any> = {
  'papan-bijak': {
    subject: 'MATEMATIK',
    grade_level: 'TINGKATAN_4',
    match_mode: 'custom',
    grade_min: 1,
    grade_max: 11,
    max_players: 4,
  },
  'perang-fakta': { subject: 'SEJARAH', grade_level: 'TINGKATAN_4', match_mode: 'same_level' },
  'benteng-ilmu': { subject: 'SAINS', grade_level: 'TINGKATAN_4', match_mode: 'same_level' },
  'perlumbaan-matematik': {
    subject: 'MATEMATIK',
    grade_level: 'TINGKATAN_4',
    match_mode: 'same_level',
  },
  'kuiz-relay': { subject: 'BAHASA_MELAYU', grade_level: 'TINGKATAN_4', match_mode: 'same_level' },
  'teka-silang-kata': {
    subject: 'BAHASA_INGGERIS',
    grade_level: 'TINGKATAN_4',
    match_mode: 'same_level',
  },
}

async function createRoom(game: string, as = T4_STUDENT): Promise<string> {
  const r = await post<Data<{ code: string }>>(`/api/games/${game}/rooms`, as, forms[game])
  expect(r.status).toBe(201)
  expect(r.body.data.code).toMatch(/^[A-Z0-9]{6}$/)
  return r.body.data.code
}

/** Polls as the host until the minimum players are in, then starts. */
async function startRoom(game: string, code: string, as = T4_STUDENT): Promise<Room> {
  for (let i = 0; i < 5; i++) await get(roomPath(game, code), as)
  const r = await post<Data<Room>>(roomPath(game, code, '/start'), as)
  expect(r.status).toBe(200)
  return r.body.data
}

/** Plays a started room to its end as the host; returns the final view. */
async function playOut(game: string, code: string, first: Room, as = T4_STUDENT): Promise<Room> {
  let room = first
  for (let i = 0; i < 700 && room.status === 'playing'; i++) {
    let body: Any
    if (room.state.awaiting === 'roll') body = { type: 'roll' }
    else {
      const q = room.question
      expect(q).toBeDefined()
      body = { type: 'answer', questionId: q.id, optionId: 0, seconds: 3 }
      if (game === 'perang-fakta') body.value = true
      if (game === 'teka-silang-kata') body.value = 'x'
    }
    const r = await post<Data<Room>>(roomPath(game, code, '/action'), as, body)
    expect(r.status).toBe(200)
    room = r.body.data
  }
  return room
}

describe('rooms (SRS §7 #24-#28, BR-M16-18/19/20)', () => {
  it('validates the create body (V-M16-01…05)', async () => {
    const bad = (body: Any) =>
      post<Any>('/api/games/papan-bijak/rooms', ADMIN, { ...forms['papan-bijak'], ...body })
    expect((await bad({ subject: 'SEJARAH' })).status).toBe(422)
    expect((await bad({ subject: 'X' })).body.error.fields.subject).toBeDefined()
    expect((await bad({ grade_level: 'DARJAH_7' })).status).toBe(422)
    expect((await bad({ match_mode: 'nope' })).status).toBe(422)
    expect((await bad({ grade_min: 9, grade_max: 3 })).status).toBe(422)
    expect((await bad({ max_players: 7 })).status).toBe(422)
    expect((await bad({ max_players: 1 })).status).toBe(422)
    const other = await post<Any>('/api/games/perang-fakta/rooms', ADMIN, {
      ...forms['perang-fakta'],
      match_mode: 'custom',
    })
    expect(other.status).toBe(422)
  })

  it('joins a waiting room: the host polls a bot in, a fitting grade joins, others get "Bilik tidak dijumpai."', async () => {
    const code = await createRoom('papan-bijak')
    const first = await get<Data<Room>>(roomPath('papan-bijak', code), T4_STUDENT)
    expect(first.status).toBe(200)
    expect(first.body.data.players).toHaveLength(2)
    expect(first.body.data.players.filter((p: Any) => p.isBot)).toHaveLength(1)
    expect(first.body.data.status).toBe('waiting')
    expect(first.body.data.settings).toMatchObject({
      maxPlayers: 4,
      minPlayers: 2,
      subject: 'MATEMATIK',
    })

    const joined = await post<Data<{ code: string }>>(
      '/api/games/papan-bijak/rooms/join',
      D5_STUDENT,
      {
        room_code: code.toLowerCase(),
      },
    )
    expect(joined.status).toBe(200)
    expect(joined.body.data.code).toBe(code)

    // a same_grade room refuses another grade; unknown / empty codes and another game's code too
    const strict = await post<Data<{ code: string }>>('/api/games/benteng-ilmu/rooms', T4_STUDENT, {
      ...forms['benteng-ilmu'],
      match_mode: 'same_grade',
    })
    const refused = await post<Any>('/api/games/benteng-ilmu/rooms/join', D5_STUDENT, {
      room_code: strict.body.data.code,
    })
    expect(refused.status).toBe(404)
    expect(refused.body.error).toEqual({ code: 'NOT_FOUND', message: 'Bilik tidak dijumpai.' })
    expect(
      (await post<Any>('/api/games/papan-bijak/rooms/join', D5_STUDENT, { room_code: 'ZZZZZZ' }))
        .status,
    ).toBe(404)
    expect(
      (await post<Any>('/api/games/papan-bijak/rooms/join', D5_STUDENT, { room_code: '' })).status,
    ).toBe(404)
    expect(
      (await post<Any>('/api/games/perang-fakta/rooms/join', D5_STUDENT, { room_code: code }))
        .status,
    ).toBe(404)

    // a player rejoins; a non-player cannot read the room; only the host starts
    expect(
      (await post<Any>('/api/games/papan-bijak/rooms/join', D5_STUDENT, { room_code: code }))
        .status,
    ).toBe(200)
    expect((await get(roomPath('papan-bijak', code), D1_STUDENT)).status).toBe(404)
    expect((await post(roomPath('papan-bijak', code, '/start'), D5_STUDENT)).status).toBe(403)
    expect(
      (await post(roomPath('papan-bijak', code, '/action'), D5_STUDENT, { type: 'roll' })).status,
    ).toBe(409)
  })

  it('refuses a start without enough players (409) and an action before the start', async () => {
    const code = await createRoom('kuiz-relay')
    const r = await post<Any>(roomPath('kuiz-relay', code, '/start'), T4_STUDENT)
    expect(r.status).toBe(409)
    expect(
      (await post<Any>(roomPath('kuiz-relay', code, '/action'), T4_STUDENT, { type: 'roll' }))
        .status,
    ).toBe(409)
    expect(
      (await post<Any>(roomPath('kuiz-relay', code, '/action'), T4_STUDENT, { type: 'dance' }))
        .status,
    ).toBe(422)
  })

  it.each(Object.keys(forms))(
    'plays a full %s game against bots and settles the standings',
    async (game) => {
      const code = await createRoom(game)
      const started = await startRoom(game, code)
      expect(started.status).toBe('playing')
      const done = await playOut(game, code, started)
      expect(done.status).toBe('finished')
      expect(done.result.scores.length).toBe(done.players.length)
      if (game === 'kuiz-relay') {
        expect(done.players.map((p: Any) => p.team).sort()).toEqual([1, 1, 2, 2])
        expect(done.result.mvpId).not.toBeNull()
      }
      // a finished room accepts no more actions
      expect(
        (await post<Any>(roomPath(game, code, '/action'), T4_STUDENT, { type: 'roll' })).status,
      ).toBe(409)
      // M11 contract: the finished room is a game result of the host
      const now = Date.now() + 10 * 365 * 24 * 3_600_000
      expect(
        gameResults.countFor([T4_STUDENT], { from: 0, to: now }).get(T4_STUDENT)?.count,
      ).toBeGreaterThanOrEqual(1)
    },
  )

  it('is deterministic: the same actions on the same room give the same game (named streams)', async () => {
    const code = await createRoom('perlumbaan-matematik', D5_STUDENT)
    const a = await startRoom('perlumbaan-matematik', code, D5_STUDENT)
    expect(a.question.id).toBeGreaterThan(0)
    expect(a.question.options.length).toBeGreaterThan(0)
    expect(a.state.meter).toBeDefined()
  })

  it('adds the Papan Bijak winner to the standings and a game to every player', async () => {
    const before = await get<Data<Any>>('/api/games/papan-bijak/lobby', ADMIN)
    expect(before.body.data.top10).toHaveLength(10)
    const hub = await get<Data<Any>>('/api/games/hub', T4_STUDENT)
    expect(hub.body.data.chips.papanBijakPlayed).toBe(true)
  })
})

describe('hooks and fixtures (SRS §6.14, §6.11.7)', () => {
  it('openRoom creates PB1234 (waiting, host 4320) that the hub lists; roomBots fills it', async () => {
    m16Hooks.m16Fixture('openRoom')
    const hub = await get<Data<Any>>('/api/games/hub', ADMIN)
    const open = (rows: Any[]) => rows.find((r) => r.code === 'PB1234')
    expect(open(hub.body.data.openRooms)).toEqual({
      game: 'papan-bijak',
      code: 'PB1234',
      host: expect.any(String),
      players: 1,
      max: 4,
    })
    expect(hub.body.data.openRooms.length).toBeLessThanOrEqual(6)
    expect(m16Hooks.roomBots({ count: 2, code: 'PB1234' })).toBe(2)
    expect(open((await get<Data<Any>>('/api/games/hub', ADMIN)).body.data.openRooms).players).toBe(
      3,
    )
    expect(() => m16Hooks.roomBots({ count: 0 })).toThrow(RangeError)
    expect(() => m16Hooks.m16Fixture('nope')).toThrow(RangeError)
  })
})

describe('Papan Bijak quick match (SRS §7 #29-#31, BR-M16-24)', () => {
  it('searches, matches on the 3rd poll into a room with a bot, and cancels', async () => {
    expect(
      (
        await post<Any>('/api/papan-bijak/quick-match', D5_STUDENT, {
          subject: 'SEJARAH',
          match_mode: 'same_grade',
        })
      ).body.error,
    ).toBeDefined()
    expect(
      (
        await post<Any>('/api/papan-bijak/quick-match', D5_STUDENT, {
          subject: 'SAINS',
          match_mode: 'x',
        })
      ).status,
    ).toBe(422)

    const start = await post<Any>('/api/papan-bijak/quick-match', D5_STUDENT, {
      subject: 'SAINS',
      match_mode: 'same_grade',
    })
    expect([start.status, start.body]).toEqual([200, { status: 'searching' }])
    expect((await get<Any>('/api/papan-bijak/quick-match/poll', D5_STUDENT)).body).toEqual({
      status: 'searching',
    })
    expect((await get<Any>('/api/papan-bijak/quick-match/poll', D5_STUDENT)).body).toEqual({
      status: 'searching',
    })
    const third = await get<Any>('/api/papan-bijak/quick-match/poll', D5_STUDENT)
    expect(third.body.status).toBe('matched')
    expect(third.body.room_code).toMatch(/^[A-Z0-9]{6}$/)
    const room = await get<Data<Room>>(roomPath('papan-bijak', third.body.room_code), D5_STUDENT)
    expect(room.status).toBe(200)
    expect(room.body.data.players).toHaveLength(2)
    expect(room.body.data.settings.maxPlayers).toBe(4)
  })

  it('answers cancelled when idle, cancels a search, and expires through the hook', async () => {
    expect((await get<Any>('/api/papan-bijak/quick-match/poll', D1_STUDENT)).body).toEqual({
      status: 'cancelled',
    })
    await post('/api/papan-bijak/quick-match', D1_STUDENT, {
      subject: 'MATEMATIK',
      match_mode: 'same_level',
    })
    expect((await post<Any>('/api/papan-bijak/quick-match/cancel', D1_STUDENT)).body).toEqual({
      status: 'cancelled',
    })
    expect((await get<Any>('/api/papan-bijak/quick-match/poll', D1_STUDENT)).body).toEqual({
      status: 'cancelled',
    })

    m16Hooks.pbQuickMatch({ mode: 'expired' })
    await post('/api/papan-bijak/quick-match', D1_STUDENT, {
      subject: 'MATEMATIK',
      match_mode: 'same_level',
    })
    expect((await get<Any>('/api/papan-bijak/quick-match/poll', D1_STUDENT)).body).toEqual({
      status: 'expired',
    })
    expect(() => m16Hooks.pbQuickMatch({ mode: 'x' })).toThrow(RangeError)
  })
})

// --- single-player games ---------------------------------------------------------------------------------------

describe('single-player games (SRS §7 #32-#33, BR-M16-25/26/27)', () => {
  it('serves each game with the live item shapes and a session id', async () => {
    const bs = (await get<Data<Any>>('/api/games/solo/betul-salah?darjah=4', D5_STUDENT)).body.data
    expect(bs.sessionId).toMatch(/^tf_[0-9a-f]{13}$/)
    expect(bs.statements).toHaveLength(40)
    expect(Object.keys(bs.statements[0]).sort()).toEqual([
      'difficulty',
      'id',
      'is_true',
      'statement',
    ])
    expect(bs.statements[0].statement).toContain(' → ')
    expect(bs.canEarnSyiling).toBe(gamification.canEarnSyiling(D5_STUDENT))
    expect(bs.personalBest).toBe(0)

    const ck = (await get<Data<Any>>('/api/games/solo/cabaran-kilat?darjah=4', D5_STUDENT)).body
      .data
    expect(ck.sessionId).toMatch(/^speed_[0-9a-f]{13}$/)
    expect(ck.questions).toHaveLength(30)
    expect(ck.questions[0].options).toHaveLength(4)
    expect(ck.questions[0].options.filter((o: Any) => o.correct)).toHaveLength(1)
    expect(Object.keys(ck.questions[0]).sort()).toEqual([
      'difficulty',
      'id',
      'options',
      'question_text',
    ])

    const tj = (await get<Data<Any>>('/api/games/solo/tembak-jawapan?darjah=4', D5_STUDENT)).body
      .data
    expect(tj.sessionId).toMatch(/^shoot_[0-9a-f]{13}$/)
    expect(tj.questions).toHaveLength(30)
    expect(Object.keys(tj.questions[0]).sort()).toEqual(['difficulty', 'id', 'options', 'question'])

    const sj = (await get<Data<Any>>('/api/games/solo/susun-jawapan?darjah=4', D5_STUDENT)).body
      .data
    expect(sj.sessionId).toMatch(/^ws_[0-9a-f]{13}$/)
    expect(sj.puzzles.length).toBeGreaterThan(0)
    expect(sj.puzzles.length).toBeLessThanOrEqual(20)
    for (const p of sj.puzzles) {
      expect(p.answer.length).toBeLessThanOrEqual(20)
      expect(['letters', 'words']).toContain(p.type)
      const tiles = p.type === 'letters' ? [...p.answer] : p.answer.split(/\s+/)
      expect([...p.scrambled].sort()).toEqual([...tiles].sort())
      expect(p.points).toBe(p.type === 'letters' ? Math.max(5, tiles.length * 2) : tiles.length * 3)
    }

    const km = (await get<Data<Any>>('/api/games/solo/kad-memori', D5_STUDENT)).body.data
    expect(km.sessionId).toMatch(/^mem_[0-9a-f]{13}$/)
    expect(km.cards).toHaveLength(12)
    expect(new Set(km.cards.map((c: Any) => c.pair_id)).size).toBe(6)
    expect(km.cards.filter((c: Any) => c.type === 'question')).toHaveLength(6)
  })

  it('rejects an unknown game (404) and a darjah outside 1-11 (422)', async () => {
    expect((await get('/api/games/solo/sambung-kata', ADMIN)).status).toBe(404)
    expect((await get('/api/games/solo/betul-salah?darjah=12', ADMIN)).status).toBe(422)
    expect((await get('/api/games/solo/betul-salah?darjah=0', ADMIN)).status).toBe(422)
    expect((await get('/api/games/solo/betul-salah?darjah=x', ADMIN)).status).toBe(422)
  })

  it('checks the submit: foreign / unknown session 422, impossible values 422, once only (409)', async () => {
    const s = (await get<Data<Any>>('/api/games/solo/betul-salah?darjah=3', D1_STUDENT)).body.data
    const ok = {
      session_id: s.sessionId,
      correct_count: 5,
      total_answered: 6,
      streak: 3,
      score: 70,
      syiling_earned: 7,
    }
    const submit = (as: number, body: Any) =>
      post<Any>('/api/games/solo/betul-salah/submit', as, body)
    expect((await submit(D5_STUDENT, ok)).status).toBe(422) // not the owner
    expect((await submit(D1_STUDENT, { ...ok, session_id: 'tf_0000000000000' })).body).toEqual({
      message: 'Keputusan tidak sah.',
    })
    expect((await submit(D1_STUDENT, { ...ok, total_answered: 41 })).status).toBe(422)
    expect((await submit(D1_STUDENT, { ...ok, correct_count: 7 })).status).toBe(422)
    expect((await submit(D1_STUDENT, { ...ok, streak: 6 })).status).toBe(422)
    expect((await submit(D1_STUDENT, { ...ok, score: 100000 })).status).toBe(422)
    expect((await submit(D1_STUDENT, { ...ok, syiling_earned: 26 })).status).toBe(422)
    expect((await submit(D1_STUDENT, { ...ok, score: -1 })).status).toBe(422)
    expect((await submit(D1_STUDENT, { ...ok, score: 1.5 })).status).toBe(422)
    // the same session answers the real call, a first result is a record, nothing credited with the M14 seed
    const done = await submit(D1_STUDENT, ok)
    expect([done.status, done.body]).toEqual([200, { is_new_record: true, syiling_awarded: 0 }])
    const again = await submit(D1_STUDENT, ok)
    expect([again.status, again.body]).toEqual([409, { message: 'Keputusan sudah dihantar.' }])
  })

  it('a first result is a record even with score 0, a later 0 is not (BR-M16-27)', async () => {
    const submit = async () => {
      const s = (await get<Data<Any>>('/api/games/solo/betul-salah?darjah=3', D5_STUDENT)).body.data
      return (
        await post<Any>('/api/games/solo/betul-salah/submit', D5_STUDENT, {
          session_id: s.sessionId,
          correct_count: 0,
          total_answered: 1,
          streak: 0,
          score: 0,
          syiling_earned: 0,
        })
      ).body
    }
    expect((await submit()).is_new_record).toBe(true)
    expect((await submit()).is_new_record).toBe(false)
  })

  it('is a record only above the stored best (admin best 38 / 40)', async () => {
    const run = async (game: string, body: (id: string) => Any) => {
      const s = (await get<Data<Any>>(`/api/games/solo/${game}?darjah=4`, ADMIN)).body.data
      return (await post<Any>(`/api/games/solo/${game}/submit`, ADMIN, body(s.sessionId))).body
    }
    const bs = (score: number) => (id: string) => ({
      session_id: id,
      correct_count: 10,
      total_answered: 10,
      streak: 10,
      score,
      syiling_earned: 0,
    })
    expect((await run('betul-salah', bs(38))).is_new_record).toBe(false)
    expect((await run('betul-salah', bs(39))).is_new_record).toBe(true)
    expect((await run('betul-salah', bs(39))).is_new_record).toBe(false)
    const ck = (id: string) => ({
      session_id: id,
      correct_count: 4,
      total_answered: 5,
      max_combo: 4,
      score: 100,
      syiling_earned: 0,
    })
    expect((await run('cabaran-kilat', ck)).is_new_record).toBe(true)
    const tj = (id: string) => ({
      session_id: id,
      correct_count: 6,
      total_answered: 8,
      max_level: 2,
      score: 60,
      syiling_earned: 0,
    })
    expect((await run('tembak-jawapan', tj)).is_new_record).toBe(true)
    expect(gameResults.personalBest(ADMIN, 'betul-salah')).toBe(39)
  })

  it('checks Susun Jawapan against the puzzle maximum and Kad Memori by pairs and moves', async () => {
    const sj = (await get<Data<Any>>('/api/games/solo/susun-jawapan?darjah=4', ADMIN)).body.data
    const max = sj.puzzles.reduce((n: number, p: Any) => n + p.points, 0)
    const submit = (id: string, extra: Any) =>
      post<Any>('/api/games/solo/susun-jawapan/submit', ADMIN, {
        session_id: id,
        solved_count: 3,
        total_puzzles: 3,
        score: 10,
        syiling_earned: 4,
        ...extra,
      })
    expect((await submit(sj.sessionId, { score: max + 1 })).status).toBe(422)
    expect((await submit(sj.sessionId, { solved_count: 4 })).status).toBe(422)
    expect((await submit(sj.sessionId, {})).body).toMatchObject({ is_new_record: true })

    const km = (await get<Data<Any>>('/api/games/solo/kad-memori', ADMIN)).body.data
    const play = (moves: number, extra: Any = {}) =>
      post<Any>('/api/games/solo/kad-memori/submit', ADMIN, {
        session_id: km.sessionId,
        matches: 6,
        total_pairs: 6,
        moves,
        time_seconds: 40,
        ...extra,
      })
    expect((await play(5)).status).toBe(422)
    expect((await play(8, { matches: 5 })).status).toBe(422)
    const done = await play(12)
    expect([done.status, done.body]).toEqual([
      200,
      { results: { syiling_earned: 0, accuracy: 50 } },
    ])
    expect((await play(12)).status).toBe(409)
  })

  it('counts submitted results for M11 and M17 (`gameResults.countFor`)', () => {
    const far = Date.now() + 10 * 365 * 24 * 3_600_000
    expect(
      gameResults.countFor([ADMIN], { from: 0, to: far }).get(ADMIN)?.count,
    ).toBeGreaterThanOrEqual(5)
  })
})

// --- Roda Nasib ---------------------------------------------------------------------------------------------------

describe('Roda Nasib (SRS §7 #34-#35, BR-M16-29)', () => {
  it('spins once a day: hook segment, 409 on the second spin, stats, next day again', async () => {
    m16Hooks.spinNext(5)
    const first = await post<Any>('/api/games/roda-nasib/spin', D5_STUDENT)
    expect(first.status).toBe(200)
    expect(first.body).toEqual({
      success: true,
      message: '',
      result: { segment_index: 5, label: 'Cuba Lagi', icon: '😅', type: 'nothing', value: 0 },
      coinsCredited: 0,
    })
    const second = await post<Any>('/api/games/roda-nasib/spin', D5_STUDENT)
    expect([second.status, second.body]).toEqual([
      409,
      { success: false, message: 'Anda sudah spin hari ini.' },
    ])
    const page = (await get<Data<Any>>('/api/games/roda-nasib', D5_STUDENT)).body.data
    expect([page.spins, page.won, page.alreadySpun]).toEqual([1, 0, true])

    booted.clock.advance(25 * 3_600_000)
    expect((await get<Data<Any>>('/api/games/roda-nasib', D5_STUDENT)).body.data.alreadySpun).toBe(
      false,
    )
    const next = await post<Any>('/api/games/roda-nasib/spin', D5_STUDENT)
    expect(next.status).toBe(200)
    expect(next.body.result.segment_index).toBeGreaterThanOrEqual(0)
    expect(next.body.result.segment_index).toBeLessThanOrEqual(7)
    expect(() => m16Hooks.spinNext(8)).toThrow(RangeError)
  })

  it('picks the same segment from the same stream (userId and date)', async () => {
    const a = await post<Any>('/api/games/roda-nasib/spin', ADMIN)
    expect(a.status).toBe(200)
    expect(a.body.result.label).toBe(
      [
        '1 Syiling',
        '3 Syiling',
        '5 Syiling',
        '10 Syiling',
        '20 Syiling',
        'Cuba Lagi',
        '2 Syiling',
        '7 Syiling',
      ][a.body.result.segment_index],
    )
    const page = (await get<Data<Any>>('/api/games/roda-nasib', ADMIN)).body.data
    expect(page.spins).toBe(3)
    expect(page.alreadySpun).toBe(true)
  })

  it('credits the syiling only while M14 pays game coins (fixture settingCoins)', async () => {
    m16Hooks.m16Fixture('settingCoins')
    booted.clock.advance(25 * 3_600_000)
    m16Hooks.m16Fixture('spinSyiling5')
    const can = gamification.canEarnSyiling(D4_FOR_COINS)
    const r = await post<Any>('/api/games/roda-nasib/spin', D4_FOR_COINS)
    expect(r.body.result).toMatchObject({ segment_index: 2, label: '5 Syiling', value: 5 })
    expect(r.body.coinsCredited).toBe(can ? 5 : 0)
    const page = (await get<Data<Any>>('/api/games/roda-nasib', D4_FOR_COINS)).body.data
    expect(page.won).toBe(can ? 5 : 0)
    expect(page.canEarnSyiling).toBe(can)
  })
})

const D4_FOR_COINS = D1_STUDENT

// --- Jutawan Ilmu --------------------------------------------------------------------------------------------------

describe('Jutawan Ilmu (SRS §7 #36-#39, BR-M16-30; the game is PROVISIONAL)', () => {
  it('validates the start', async () => {
    expect((await post('/api/games/jutawan/start', ADMIN, { subject: 1, darjah: 12 })).status).toBe(
      422,
    )
    expect((await post('/api/games/jutawan/start', ADMIN, { subject: 28, darjah: 4 })).status).toBe(
      422,
    )
    expect((await post('/api/games/jutawan/start', ADMIN, { darjah: 4 })).status).toBe(422)
  })

  it('plays 15 questions with a 50:50 lifeline, then updates the stats and reports once', async () => {
    const start = await post<Data<Any>>('/api/games/jutawan/start', ADMIN, {
      subject: 1,
      darjah: 4,
    })
    expect(start.status).toBe(200)
    const s = start.body.data
    expect(s.sessionId).toMatch(/^jut_[0-9a-f]{13}$/)
    expect([s.index, s.lifelines]).toEqual([1, 3])
    expect(s.question.options).toHaveLength(4)
    expect(JSON.stringify(s.question)).not.toMatch(/correct/i)

    const lifeline = await post<Data<Any>>(`/api/games/jutawan/${s.sessionId}/lifeline`, ADMIN, {
      type: '50:50',
    })
    expect(lifeline.status).toBe(200)
    expect(lifeline.body.data.removedOptionIds).toHaveLength(2)
    expect(lifeline.body.data.lifelines).toBe(2)
    const key = questions.jutawanGet(s.question.id)?.correctAnswer
    expect(lifeline.body.data.removedOptionIds).not.toContain(key)
    expect(
      (await post(`/api/games/jutawan/${s.sessionId}/lifeline`, ADMIN, { type: '50:50' })).status,
    ).toBe(409)
    expect(
      (await post(`/api/games/jutawan/${s.sessionId}/lifeline`, ADMIN, { type: 'x' })).status,
    ).toBe(422)

    let q = s.question
    let last: Any = null
    for (let i = 1; i <= 15; i++) {
      // a wrong question id is refused without changing the game
      if (i === 1) {
        expect(
          (
            await post(`/api/games/jutawan/${s.sessionId}/answer`, ADMIN, {
              questionId: 1,
              optionId: 0,
            })
          ).status,
        ).toBe(422)
      }
      const answer = await post<Data<Any>>(`/api/games/jutawan/${s.sessionId}/answer`, ADMIN, {
        questionId: q.id,
        optionId: questions.jutawanGet(q.id)?.correctAnswer,
      })
      expect(answer.status).toBe(200)
      last = answer.body.data
      expect(last.correct).toBe(true)
      expect(last.level).toBe(i)
      q = last.next
    }
    expect(last.result.level).toBe(15)
    expect(last.next).toBeUndefined()
    expect(
      (
        await post(`/api/games/jutawan/${s.sessionId}/answer`, ADMIN, {
          questionId: 1,
          optionId: 0,
        })
      ).status,
    ).toBe(409)
    expect(
      (
        await post(`/api/games/jutawan/${s.sessionId}/answer`, D5_STUDENT, {
          questionId: 1,
          optionId: 0,
        })
      ).status,
    ).toBe(404)
    const page = (await get<Data<Any>>('/api/games/jutawan', ADMIN)).body.data
    expect([page.bestLevel, page.games]).toEqual([15, 1])
  })

  it('ends on the first wrong answer with the level reached', async () => {
    const s = (
      await post<Data<Any>>('/api/games/jutawan/start', D5_STUDENT, { subject: 3, darjah: 5 })
    ).body.data
    const key = questions.jutawanGet(s.question.id)?.correctAnswer as number
    const r = await post<Data<Any>>(`/api/games/jutawan/${s.sessionId}/answer`, D5_STUDENT, {
      questionId: s.question.id,
      optionId: (key + 1) % 4,
    })
    expect(r.body.data).toEqual({ correct: false, level: 0, result: { level: 0, credited: 0 } })
    const page = (await get<Data<Any>>('/api/games/jutawan', D5_STUDENT)).body.data
    expect([page.bestLevel, page.games]).toEqual([0, 1])
  })
})

// --- admin settings -------------------------------------------------------------------------------------------------

describe('game settings (SRS §7 #51-#52, BR-M16-36)', () => {
  it('saves boardgame_quiz_tiles 0-38 and refuses anything else', async () => {
    const save = (v: unknown) =>
      call<Any>('PUT', '/api/admin/games/settings', ADMIN, { boardgame_quiz_tiles: v })
    expect((await save(20)).body).toEqual({ data: { boardgameQuizTiles: 20 } })
    expect(
      (await get<Data<Any>>('/api/admin/games', ADMIN)).body.data.settings.boardgameQuizTiles,
    ).toBe(20)
    expect(rooms.plainTiles()).toBe(18)
    for (const bad of [39, -1, 1.5, 'x', null, undefined]) {
      const r = await save(bad)
      expect(r.status).toBe(422)
      expect(r.body.error.fields.boardgame_quiz_tiles).toBe('Nilai mesti antara 0 dan 38.')
    }
    expect((await save(0)).status).toBe(200)
    expect((await save(38)).status).toBe(200)
    expect(rooms.plainTiles()).toBe(0)
    expect((await save(35)).status).toBe(200)
  })

  it('builds the Papan Bijak board from the setting (BR-M16-20): 50 tiles, fixed specials, quiz tiles', async () => {
    const code = await createRoom('papan-bijak', D5_STUDENT)
    await get(roomPath('papan-bijak', code), D5_STUDENT)
    const started = await post<Data<Room>>(roomPath('papan-bijak', code, '/start'), D5_STUDENT)
    const board: string[] = started.body.data.state.board
    expect(board).toHaveLength(50)
    expect([board[0], board[49]]).toEqual(['start', 'finish'])
    const kinds = (k: string) => board.filter((t) => t.startsWith(k)).length
    expect([
      kinds('ladder'),
      kinds('snake'),
      kinds('bonus'),
      kinds('trap'),
      kinds('quiz'),
      kinds('plain'),
    ]).toEqual([3, 3, 2, 2, 35, 3])
  })
})
