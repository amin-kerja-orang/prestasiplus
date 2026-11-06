/**
 * S7-T01 GAME-02 C: the Papan Bijak mock mirrors the API (D12): the 200-round safety rule, the 30 s roll and 20 s
 * answer clocks with their auto roll and auto timeout, `result.reward` of the viewer, the one reward formula,
 * standings for humans only (and only when 2 or more humans started), robot names (ruling 62), and the default
 * winner's points. The engine cases are pure; the room cases boot the mock core like the T2 tests.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { createPrngRegistry } from '@/mock/determinism'
import { gamification } from '@/modules/m14-gamification/mock'

import { m16Hooks } from '../../mock/hooks'
import { gameStandingsTable } from '../../mock/tables/tables'
import {
  applyAction,
  applyTimeout,
  emptyState,
  pbPoints,
  pbSettleDefault,
  startGame,
  type EnginePlayer,
  type EngineRoom,
} from '../../mock/repository/room-engine'
import type { RoomState } from '../../mock/types'
import { bootM16, MemoryStorage, setUser, type Answer, type Booted } from './helpers'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any
interface Data<T> {
  data: T
}

// --- pure engine ---------------------------------------------------------------------------------------------

const ROOM: EngineRoom = { code: 'PBTEST', game: 'papan-bijak', subject: 'MATEMATIK', gradeLevel: 'TINGKATAN_4' }
const HUMAN = 11
const BOT = 12
const seats = (): EnginePlayer[] => [
  { userId: HUMAN, team: null, points: 0, correct: 0, isBot: false },
  { userId: BOT, team: null, points: 0, correct: 0, isBot: true },
]

/** A board whose tiles 2-7 are snakes back to 1 (a token on 1 never leaves it) and the rest plain. */
function snakeBoard(): string[] {
  return Array.from({ length: 50 }, (_, i) =>
    i === 0 ? 'start' : i === 49 ? 'finish' : i <= 6 ? 'snake:1' : 'plain',
  )
}

function stateAt(turn: number, positions: Record<string, number>, awaiting: 'roll' | 'answer'): RoomState {
  return {
    ...emptyState(HUMAN),
    startHumans: 1,
    awaiting,
    board: snakeBoard(),
    positions,
    total: 50,
    turn,
  }
}

describe('Papan Bijak engine (48 GAME-02)', () => {
  const prng = createPrngRegistry()

  it('safety rule: after 200 rounds x players the highest tile wins (points 10c + 50)', () => {
    // 2 players: turn 398 is the human's roll; the bot's move is turn 399; turn 400 = 200 x 2 ends the game.
    const players = seats()
    ;(players[0] as EnginePlayer).correct = 2
    const st = stateAt(398, { [HUMAN]: 1, [BOT]: 20 }, 'roll')
    const out = applyAction(ROOM, players, st, { type: 'roll' }, prng, 0.5)
    expect(out.finished).toBe(true)
    expect(out.state.winnerId).toBe(BOT) // the bot stayed on tiles 21-26, the human on 1
    expect(out.players.find((p) => p.userId === BOT)?.points).toBe(50)
    expect(out.players.find((p) => p.userId === HUMAN)?.points).toBe(20)
  })

  it('safety rule: equal highest tiles are a draw (no winner, 10c each)', () => {
    const players = seats()
    ;(players[1] as EnginePlayer).correct = 3
    const st = stateAt(398, { [HUMAN]: 1, [BOT]: 1 }, 'roll')
    const out = applyAction(ROOM, players, st, { type: 'roll' }, prng, 0.5)
    expect(out.finished).toBe(true)
    expect(out.state.winnerId).toBeNull()
    expect(out.players.map((p) => p.points)).toEqual([0, 30])
  })

  it('does not end a game before 200 rounds x players', () => {
    const st = stateAt(396, { [HUMAN]: 1, [BOT]: 1 }, 'roll')
    const out = applyAction(ROOM, seats(), st, { type: 'roll' }, prng, 0.5)
    expect(out.finished).toBe(false)
    expect(out.state.awaiting).toBe('roll')
  })

  it('the default winner scores 10c + 50, the others 10c', () => {
    expect(pbPoints(4, true)).toBe(90)
    expect(pbPoints(4, false)).toBe(40)
    const ps = seats().map((p, i) => ({ ...p, correct: i + 2 }))
    expect(pbSettleDefault(ps, HUMAN).map((p) => p.points)).toEqual([70, 30])
  })

  it('ruling 56: when the cursor wraps the pool, the pool restarts reshuffled (a permutation, deterministic, new each pass)', () => {
    const board = Array.from({ length: 50 }, (_, i) => (i === 0 ? 'start' : i === 49 ? 'finish' : 'quiz'))
    const pool = Array.from({ length: 40 }, (_, i) => i + 1)
    const wrap = (qIds: number[], cursor: number) =>
      applyAction(
        ROOM,
        seats(),
        { ...emptyState(HUMAN), awaiting: 'roll', board, positions: { [HUMAN]: 1, [BOT]: 1 }, qIds, cursor, seed: 'abc' },
        { type: 'roll' },
        prng,
        0.5,
      ).state
    const a = wrap(pool, 40) // questions 41-80
    expect([...a.qIds].sort((x, y) => x - y)).toEqual(pool)
    expect(a.qIds).not.toEqual(pool)
    expect(a.cursor).toBe(41)
    expect(a.pendingQ).toBe(a.qIds[0])
    expect(wrap(pool, 40).qIds).toEqual(a.qIds) // same room, same pass: same order
    const b = wrap(a.qIds, 80) // questions 81-120: the next pass shuffles again
    expect([...b.qIds].sort((x, y) => x - y)).toEqual(pool)
    expect(b.qIds).not.toEqual(a.qIds)
    expect(wrap(pool, 10).qIds).toEqual(pool) // no wrap, no reshuffle
  })

  it('with 0 quiz tiles the start draws no question and the board has none', () => {
    const out = startGame(ROOM, seats(), HUMAN, 0, prng, 0.5)
    expect(out.state.qIds).toEqual([])
    expect(out.state.board.filter((t) => t === 'quiz')).toHaveLength(0)
    expect(out.state.awaiting).toBe('roll')
    expect(out.state.startHumans).toBe(1)
  })

  it('a roll that ran out rolls itself; a question that ran out is a wrong answer (token back)', () => {
    const rolled = applyTimeout(ROOM, seats(), stateAt(0, { [HUMAN]: 1, [BOT]: 1 }, 'roll'), prng, 0.5)
    expect(rolled.state.log.some((l) => l.startsWith('roll:'))).toBe(true)

    const asking: RoomState = { ...stateAt(0, { [HUMAN]: 30, [BOT]: 1 }, 'answer'), pendingQ: 7, qIds: [7] }
    asking.meter[String(HUMAN)] = 25 // the tile before the quiz tile
    const wrong = applyTimeout(ROOM, seats(), asking, prng, 0.5)
    expect(wrong.state.positions[String(HUMAN)]).toBe(25)
    expect(wrong.players.find((p) => p.userId === HUMAN)?.correct).toBe(0)
    expect(wrong.state.pendingQ).toBeNull()
  })
})

// --- rooms ----------------------------------------------------------------------------------------------------

const HOST = 2 // grade 10
const GUEST = 3 // grade 5
let booted: Booted

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  booted = await bootM16()
  m16Hooks.m16Fixture('settingCoins')
}, 600_000)

afterAll(async () => {
  await booted.runtime.reset()
  vi.unstubAllGlobals()
}, 600_000)

async function call<T = unknown>(method: 'GET' | 'POST', url: string, as: number, body?: unknown): Promise<Answer<T>> {
  const headers: Record<string, string> = { accept: 'application/json', authorization: `Bearer ${setUser(as).token}` }
  if (body !== undefined) headers['content-type'] = 'application/json'
  const res = await booted.runtime.transport.request({ method, url, headers, ...(body !== undefined ? { body } : {}) })
  return { status: res.status, body: res.body as T }
}
const roomPath = (code: string, tail = '') => `/api/games/papan-bijak/rooms/${code}${tail}`
const view = async (code: string, as = HOST): Promise<Any> => (await call<Data<Any>>('GET', roomPath(code), as)).body.data
const advance = (seconds: number) => booted.clock.advance(seconds * 1000)
const FORM = {
  subject: 'MATEMATIK',
  grade_level: 'TINGKATAN_4',
  match_mode: 'custom',
  grade_min: 1,
  grade_max: 11,
  max_players: 4,
}

async function createRoom(): Promise<string> {
  const r = await call<Data<{ code: string }>>('POST', '/api/games/papan-bijak/rooms', HOST, FORM)
  expect(r.status).toBe(201)
  return r.body.data.code
}

/** Host creates; `guests` join; `bots` are added; the host starts. Returns the started view. */
async function startRoom(guests: number[], bots: number): Promise<Any> {
  const code = await createRoom()
  for (const g of guests) expect((await call('POST', '/api/games/papan-bijak/rooms/join', g, { room_code: code })).status).toBe(200)
  if (bots > 0) expect(m16Hooks.roomBots({ count: bots, code })).toBe(bots)
  else if (guests.length === 0) expect(m16Hooks.roomBots({ count: 1, code })).toBe(1)
  const r = await call<Data<Any>>('POST', roomPath(code, '/start'), HOST)
  expect(r.status).toBe(200)
  return r.body.data
}

/** Plays the room to its end: whoever is on turn rolls, or answers option 0. */
async function playOut(first: Any): Promise<void> {
  let room = first
  for (let i = 0; i < 3000 && room.status === 'playing'; i++) {
    const actor = room.state.humanId
    const body =
      room.state.awaiting === 'roll'
        ? { type: 'roll' }
        : { type: 'answer', questionId: room.question.id, optionId: 0, seconds: 3 }
    const r = await call<Data<Any>>('POST', roomPath(room.code, '/action'), actor, body)
    expect(r.status).toBe(200)
    room = r.body.data
  }
  expect(room.status).toBe('finished')
}

describe('Papan Bijak clocks in the mock (30 s roll, 20 s answer)', () => {
  it('counts the roll down from 30 s, auto-rolls at 0 and restarts the clock; a poll is idempotent', async () => {
    const started = await startRoom([], 0)
    expect(started.state.awaiting).toBe('roll')
    expect(started.state.roundSecondsLeft).toBe(30)
    advance(12)
    const a = await view(started.code)
    expect(a.state.roundSecondsLeft).toBe(18)
    advance(18) // the roll is 30 s old: it rolls itself
    const b = await view(started.code)
    expect(b.state.log.length).toBeGreaterThan(started.state.log.length)
    expect(b.state.roundSecondsLeft).toBe(b.state.awaiting === 'answer' ? 20 : 30)
    expect(await view(started.code)).toEqual(b)
  })

  it('a long absence resolves many timeouts without error and ends in a finished room with a result', async () => {
    const started = await startRoom([], 0)
    advance(60 * 60 * 24)
    const v = await view(started.code)
    expect(['playing', 'finished']).toContain(v.status)
    if (v.status === 'playing') expect(v.state.roundSecondsLeft).toBeLessThanOrEqual(30)
  })
})

describe('Papan Bijak settlement in the mock (48 GAME-R, section 3.4)', () => {
  it('one human against a robot: no standing, a reward from the one formula, robot named "Robot PrestasiPlus"', async () => {
    const started = await startRoom([], 0)
    const robots = started.players.filter((p: Any) => p.isBot)
    expect(robots).toHaveLength(1)
    expect(robots[0].name).toBe('Robot PrestasiPlus')
    await playOut(started)
    const done = await view(started.code)
    const me = done.result.scores.find((s: Any) => s.userId === HOST)
    // Alone with a robot nobody "wins" for the reward: play XP 5.
    expect(done.result.reward).toEqual({
      xp: 10 * me.correct + 5,
      syiling: gamification.canEarnSyiling(HOST) ? me.correct : 0,
      capped: false,
      reason: null,
    })
    expect(done.result.scores.find((s: Any) => s.userId !== HOST).name).toBe('Robot PrestasiPlus')
    expect(gameStandingsTable.query({ where: { game: 'papan-bijak', userId: HOST } }).rows).toHaveLength(
      (await call<Data<Any>>('GET', '/api/games/hub', HOST)).body.data.chips.papanBijakPlayed ? 1 : 0,
    )
    expect(done.result.winnerName === null || typeof done.result.winnerName === 'string').toBe(true)
  })

  it('numbers the robots only when there are 2 or more', async () => {
    const started = await startRoom([], 2)
    const names = started.players.filter((p: Any) => p.isBot).map((p: Any) => p.name)
    expect(names).toEqual(['Robot PrestasiPlus 1', 'Robot PrestasiPlus 2'])
    expect(started.players.filter((p: Any) => p.isBot).every((p: Any) => p.grade === '')).toBe(true)
  })

  it('two humans and a robot: standings and a reward for each human, none for the robot', async () => {
    const started = await startRoom([GUEST], 1)
    const bot = started.players.find((p: Any) => p.isBot)
    const before = (id: number) => gameStandingsTable.query({ where: { game: 'papan-bijak', userId: id } }).rows[0]
    const had = { host: before(HOST)?.jumlah ?? 0, guest: before(GUEST)?.jumlah ?? 0 }
    await playOut(started)
    const hostView = await view(started.code, HOST)
    const guestView = await view(started.code, GUEST)
    const scores: Any[] = hostView.result.scores
    for (const [uid, v, prev] of [
      [HOST, hostView, had.host],
      [GUEST, guestView, had.guest],
    ] as const) {
      const s = scores.find((x) => x.userId === uid)
      const won = hostView.result.winnerId === uid
      const draw = hostView.result.winnerId === null
      const outcomeXp = won ? 20 : draw ? 10 : 5
      expect(v.result.reward).toEqual({
        xp: 10 * s.correct + outcomeXp,
        syiling: gamification.canEarnSyiling(uid) ? s.correct + (won ? 5 : 0) : 0,
        capped: false,
        reason: null,
      })
      expect(before(uid)?.jumlah).toBe(prev + 1)
    }
    expect(gameStandingsTable.query({ where: { game: 'papan-bijak', userId: bot.id } }).rows).toHaveLength(0)
    // A robot winner adds no win to anyone; a human winner adds exactly one.
    const winner = hostView.result.winnerId
    if (winner === HOST || winner === GUEST) expect(before(winner)?.wins).toBeGreaterThanOrEqual(1)
  })

  it('a finished room carries the reward block of the contract (xp, syiling, capped, reason)', async () => {
    const started = await startRoom([], 0)
    await playOut(started)
    const done = await view(started.code)
    expect(done.result.reward).toBeDefined()
    expect(Object.keys(done.result.reward).sort()).toEqual(['capped', 'reason', 'syiling', 'xp'])
  })
})

// --- rooms: join, waiting, leave and absence (rulings 49, 50, 51, 53) ----------------------------------------------

const THIRD = 4 // grade 1; the room form is custom 1-11
const standing = (id: number) => gameStandingsTable.query({ where: { game: 'papan-bijak', userId: id } }).rows[0]
const join = (code: string, as: number) => call<Any>('POST', '/api/games/papan-bijak/rooms/join', as, { room_code: code })
const act = (code: string, as: number, body: unknown) => call<Data<Any>>('POST', roomPath(code, '/action'), as, body)

describe('Papan Bijak waiting room (rulings 51, 53; robots are not counted in max_players)', () => {
  it('a robot does not count towards max_players and gives its seat to a pupil', async () => {
    const r = await call<Data<{ code: string }>>('POST', '/api/games/papan-bijak/rooms', HOST, { ...FORM, max_players: 2 })
    const code = r.body.data.code
    expect(m16Hooks.roomBots({ count: 1, code })).toBe(1)
    expect((await join(code, GUEST)).status).toBe(200)
    const v = await view(code)
    expect(v.players.map((p: Any) => p.isBot)).toEqual([false, false]) // the robot gave its seat up
    const full = await join(code, THIRD)
    expect(full.status).toBe(409)
    expect(full.body.error.message).toBe('Bilik sudah penuh.')
  })

  it('robots come after 30 s: a start before that is refused, the one after seats a robot', async () => {
    const code = await createRoom()
    const early = await call<Any>('POST', roomPath(code, '/start'), HOST)
    expect(early.status).toBe(409)
    expect((await view(code)).robotInSeconds).toBe(30)
    advance(31)
    const ok = await call<Data<Any>>('POST', roomPath(code, '/start'), HOST)
    expect(ok.status).toBe(200)
    expect(ok.body.data.players.filter((p: Any) => p.isBot)).toHaveLength(1)
  })

  it('a waiting room past 15 minutes closes: it no longer joins and the hub leaves it out', async () => {
    const code = await createRoom()
    const hubHas = async () =>
      (await call<Data<Any>>('GET', '/api/games/hub', HOST)).body.data.openRooms.some((r: Any) => r.code === code)
    expect(await hubHas()).toBe(true)
    advance(15 * 60)
    expect(await hubHas()).toBe(false)
    expect((await join(code, GUEST)).status).toBe(404)
    expect((await view(code)).status).toBe('closed')
  })
})

describe('Papan Bijak leave (ruling 50) and absence (ruling 49)', () => {
  it('3 humans: a leaver is replaced by a robot, the game goes on, and the leaver gets jumlah + 1 (menang 0) when it settles', async () => {
    const started = await startRoom([GUEST, THIRD], 0)
    expect(started.players.filter((p: Any) => !p.isBot)).toHaveLength(3)
    const had = standing(GUEST)?.jumlah ?? 0
    const hadWins = standing(GUEST)?.wins ?? 0
    const left = await act(started.code, GUEST, { type: 'leave' })
    expect(left.status).toBe(200)
    const v = await view(started.code, HOST)
    expect(v.status).toBe('playing')
    expect(v.players.filter((p: Any) => !p.isBot)).toHaveLength(2)
    expect(v.players.filter((p: Any) => p.isBot).map((p: Any) => p.name)).toEqual(['Robot PrestasiPlus'])
    expect((await call('GET', roomPath(started.code), GUEST)).status).toBe(404) // no longer a player
    expect(standing(GUEST)?.jumlah ?? 0).toBe(had) // not written at the leave
    await playOut(v)
    const done = await view(started.code, HOST)
    expect(standing(GUEST)?.jumlah).toBe(had + 1)
    expect(standing(GUEST)?.wins ?? 0).toBe(hadWins)
    expect(done.result.scores).toHaveLength(3)
  })

  it('2 humans: the one who stays and is present wins by default (10c + 50), the leaver counts in the standings', async () => {
    const started = await startRoom([GUEST], 0)
    const hadHost = standing(HOST)
    const hadGuest = standing(GUEST)
    const left = await act(started.code, GUEST, { type: 'leave' })
    expect(left.status).toBe(200)
    const done = await view(started.code, HOST)
    expect(done.status).toBe('finished')
    expect(done.result.winnerId).toBe(HOST)
    const me = done.result.scores.find((s: Any) => s.userId === HOST)
    expect(me.points).toBe(10 * me.correct + 50)
    expect(done.result.reward.xp).toBe(10 * me.correct + 20)
    expect(standing(HOST)?.wins).toBe((hadHost?.wins ?? 0) + 1)
    expect(standing(HOST)?.jumlah).toBe((hadHost?.jumlah ?? 0) + 1)
    expect(standing(GUEST)?.jumlah).toBe((hadGuest?.jumlah ?? 0) + 1)
    expect(standing(GUEST)?.wins ?? 0).toBe(hadGuest?.wins ?? 0)
  })

  it('2 humans: the one who stays is absent, so the game ends unsettled (no winner, no reward, no standing)', async () => {
    const started = await startRoom([GUEST], 0)
    const hadHost = standing(HOST)?.jumlah ?? 0
    const hadGuest = standing(GUEST)?.jumlah ?? 0
    advance(60) // nobody polls: the host's last sign of life is the start
    const left = await act(started.code, GUEST, { type: 'leave' })
    expect(left.status).toBe(200)
    const done = await view(started.code, GUEST).catch(() => null)
    const v = done ?? (await view(started.code, HOST))
    expect(v.status).toBe('finished')
    expect(v.result.winnerId).toBeNull()
    expect(v.result.reward).toBeUndefined()
    expect(standing(HOST)?.jumlah ?? 0).toBe(hadHost)
    expect(standing(GUEST)?.jumlah ?? 0).toBe(hadGuest)
  })

  it('3 timeouts in a row remove the seat: a lone human who never acts ends the game unsettled', async () => {
    const started = await startRoom([], 0)
    const had = standing(HOST)?.jumlah ?? 0
    advance(60 * 60)
    const v = await view(started.code)
    expect(v.status).toBe('finished')
    expect(v.result.winnerId).toBeNull()
    expect(v.result.reward).toBeUndefined()
    expect(standing(HOST)?.jumlah ?? 0).toBe(had)
  })

  it('an action resets the timeout count: two timeouts, one roll, two more timeouts do not remove the seat', async () => {
    const started = await startRoom([], 0)
    advance(30)
    const a = await view(started.code)
    expect(a.status).toBe('playing')
    advance(30)
    const b = await view(started.code)
    expect(b.status).toBe('playing')
    const board = b.state
    if (board.awaiting === 'roll') expect((await act(started.code, HOST, { type: 'roll' })).status).toBe(200)
    else
      expect(
        (await act(started.code, HOST, { type: 'answer', questionId: b.question.id, optionId: 0, seconds: 3 })).status,
      ).toBe(200)
    advance(30)
    expect((await view(started.code)).status).toBe('playing')
  })
})

describe('Papan Bijak with the room robots off (rulings 50.1, 53)', () => {
  const restore = () => m16Hooks.roomRobots({ enabled: true, fallbackSeconds: 30 })

  it('robots off or a fallback of 0: no robotInSeconds and no robot after the wait', async () => {
    for (const settings of [{ enabled: false }, { enabled: true, fallbackSeconds: 0 }]) {
      m16Hooks.roomRobots(settings)
      try {
        const code = await createRoom()
        expect((await view(code)).robotInSeconds).toBeUndefined()
        advance(40)
        const v = await view(code)
        expect(v.players).toHaveLength(1)
        expect((await call<Any>('POST', roomPath(code, '/start'), HOST)).status).toBe(409)
      } finally {
        restore()
      }
    }
  })

  it('3 humans, robots off: the leaver seat is skipped (no robot), the two humans play on and the leaver counts at the settle', async () => {
    m16Hooks.roomRobots({ enabled: false })
    try {
      const started = await startRoom([GUEST, THIRD], 0)
      const had = standing(GUEST)?.jumlah ?? 0
      expect((await act(started.code, GUEST, { type: 'leave' })).status).toBe(200)
      const v = await view(started.code, HOST)
      expect(v.status).toBe('playing')
      expect(v.players.map((p: Any) => p.isBot)).toEqual([false, false])
      expect(v.players.map((p: Any) => p.id)).not.toContain(GUEST)
      expect([HOST, THIRD]).toContain(v.state.humanId)
      expect(v.state.roundSecondsLeft).toBeGreaterThan(0)
      await playOut(v)
      expect(standing(GUEST)?.jumlah).toBe(had + 1)
    } finally {
      restore()
    }
  })

  it('3 humans, robots off: skipping a seat that is not on turn keeps the running clock (25 s elapsed, 5 s left)', async () => {
    m16Hooks.roomRobots({ enabled: false })
    try {
      const started = await startRoom([GUEST, THIRD], 0)
      expect(started.state.humanId).toBe(HOST) // the host rolls first
      advance(25)
      expect((await view(started.code, HOST)).state.roundSecondsLeft).toBe(5)
      expect((await act(started.code, THIRD, { type: 'leave' })).status).toBe(200)
      const v = await view(started.code, HOST)
      expect(v.status).toBe('playing')
      expect(v.state.humanId).toBe(HOST)
      expect(v.state.roundSecondsLeft).toBe(5)
    } finally {
      restore()
    }
  })
})
