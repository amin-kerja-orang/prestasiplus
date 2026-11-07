import { GAMES_MESSAGES, type GamesRoomView } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { RoomsService } from '../../../src/modules/games/rooms/rooms.service'
import { ACCOUNTS, bootGamesApp, expectError, loginAs, START, type Client, type GamesTestApp } from '../helpers'
import { FORM, P, PB_FORM, ageRoom, createRoom, insertShortMcqs, parseRoom, stateOf } from './support'

const M = GAMES_MESSAGES

/**
 * S7-T01 part GAME-R, R2: the multi-human room engine on the real rewards and answer-store wiring. Papan Bijak (GAME-02) and
 * Kuiz Relay (GAME-06) are fully multi-human; Perang Fakta, Benteng Ilmu, Perlumbaan Matematik and Teka Silang Kata stay
 * single-acting-human ("own part", GAME-03/04/05/07) and keep their own specs.
 */
describe('multi-human rooms (R2): Papan Bijak and Kuiz Relay', () => {
  let t: GamesTestApp
  let a: Client
  let b: Client
  let solo: Client

  beforeAll(async () => {
    t = await bootGamesApp({ withGamification: true })
    await insertShortMcqs(t.db, { subject: 'MATH', level: 'T4', count: 60, prefix: 'MH' })
    a = await loginAs(t, ACCOUNTS.student)
    b = await loginAs(t, ACCOUNTS.student2)
    solo = await loginAs(t, ACCOUNTS.teacher)
    // These specs act on a frozen clock; the pace guard has its own spec (core/game-rules.spec).
    await t.db.query(`update gamification_settings set value = 0 where key = 'games_min_ms_per_answer'`)
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    t.clock.set(START)
    await t.db.query('delete from game_standings')
    await t.db.query('delete from game_reward_events')
  })

  const join = (c: Client, game: string, code: string) => c.post(P(game, undefined, '/join'), { room_code: code })
  const standing = async (game: string, userId: string) =>
    (await t.db.query<{ wins: number; jumlah: number; skor: number; betul: number }>('select wins, jumlah, skor, betul from game_standings where game = $1 and user_id = $2', [game, userId]))[0]
  const events = (code: string) =>
    t.db.query<{ user_id: string }>(
      'select user_id::text from game_reward_events where game_session_id = (select session_id from game_rooms where code = $1) order by user_id',
      [code],
    )
  const answerRows = (code: string) =>
    t.db.query<{ user_id: string; n: number }>(
      `select user_id::text, count(*)::int as n from practice_answers where attempt_id = (select session_id from game_rooms where code = $1) group by user_id order by user_id`,
      [code],
    )
  const clients = (): Record<string, Client> => ({ [a.userId]: a, [b.userId]: b })

  /** Plays the room to the end: whoever the room waits for acts, and the other human is refused on that turn. */
  async function playOut(code: string, game: string, v0: GamesRoomView, right = true): Promise<GamesRoomView> {
    let v = v0
    let refused = 0
    for (let i = 0; i < 1200 && v.status === 'playing'; i++) {
      t.clock.advance(1_000)
      const turn = v.state?.humanId as string
      const actor = clients()[turn] as Client
      const other = turn === a.userId ? b : a
      const st = await stateOf(t.db, code)
      const body =
        v.state?.awaiting === 'roll'
          ? { type: 'roll' }
          : { type: 'answer', questionId: st.pendingQ, optionId: ((st.qs[st.pendingQ as string] as { keyIndex: number }).keyIndex + (right ? 0 : 1)) % 4, seconds: 0 }
      if (refused < 3) {
        expectError(await other.post(P(game, code, '/action'), body), 'FORBIDDEN', M.actionNotYourTurn) // each human acts on their turn only
        refused += 1
      }
      v = parseRoom(await actor.post(P(game, code, '/action'), body))
    }
    return v
  }

  it('Papan Bijak: two humans and a robot (a third human left, ruling 50) play to the end; standings, one reward event and the answer rows exist for BOTH humans', async () => {
    const code = await createRoom(a, 'papan-bijak', { ...PB_FORM, match_mode: 'same_level' })
    await join(b, 'papan-bijak', code)
    await join(solo, 'papan-bijak', code)
    parseRoom(await a.post(P('papan-bijak', code, '/start')))
    const start = parseRoom(await solo.post(P('papan-bijak', code, '/action'), { type: 'leave' }))
    expect(start.players.map((p) => p.isBot)).toEqual([false, false, true]) // a robot took the leaver's seat
    expect(start.status).toBe('playing')
    const v = await playOut(code, 'papan-bijak', start)
    expect(v.status).toBe('finished')
    expect(await standing('papan-bijak', solo.userId)).toEqual({ wins: 0, jumlah: 1, skor: 0, betul: 0 }) // the leaver: jumlah + 1 only
    for (const c of [a, b]) {
      const mine = v.result?.scores.find((s) => s.userId === c.userId)
      expect(await standing('papan-bijak', c.userId)).toMatchObject({ jumlah: 1, skor: mine?.points, betul: mine?.correct })
    }
    expect((await events(code)).map((e) => e.user_id).sort()).toEqual([a.userId, b.userId].sort()) // one reward event per human
    const rows = await answerRows(code)
    const st = await stateOf(t.db, code)
    expect(rows.map((r) => [r.user_id, r.n])).toEqual([a.userId, b.userId].sort().map((id) => [id, st.seats?.[id]?.answerCount ?? 0]).filter(([, n]) => (n as number) > 0))
    // each human reads their own reward block; the two blocks are the caller's own
    const ra = parseRoom(await a.get(P('papan-bijak', code))).result?.reward
    const rb = parseRoom(await b.get(P('papan-bijak', code))).result?.reward
    expect(ra).toBeDefined()
    expect(rb).toBeDefined()
    expect(await t.db.query('select 1 from game_reward_events where user_id = $1::bigint', [solo.userId])).toHaveLength(0) // no reward for the leaver
  }, 120_000)

  it('Kuiz Relay: two humans and two robots play 10 rounds; each human answers their own rounds; standings and rewards for both', async () => {
    const code = await createRoom(a, 'kuiz-relay', { ...FORM, match_mode: 'same_level', max_players: 4 })
    await join(b, 'kuiz-relay', code)
    await ageRoom(t, code)
    const start = parseRoom(await a.post(P('kuiz-relay', code, '/start')))
    expect(start.players.map((p) => p.isBot)).toEqual([false, false, true, true])
    const v = await playOut(code, 'kuiz-relay', start)
    expect(v.status).toBe('finished')
    for (const c of [a, b]) expect(await standing('kuiz-relay', c.userId)).toMatchObject({ jumlah: 1 })
    const winners = (await Promise.all([a, b].map((c) => standing('kuiz-relay', c.userId)))).reduce((n, s) => n + (s?.wins ?? 0), 0)
    expect(winners).toBeLessThanOrEqual(1) // only the MVP has the standing win
    expect((await events(code)).length).toBe(2)
    const st = await stateOf(t.db, code)
    expect([st.seats?.[a.userId]?.answerCount, st.seats?.[b.userId]?.answerCount]).toEqual([3, 3]) // rounds 1,5,9 and 2,6,10
  }, 120_000)

  it('a robot-only game and a single-human game change no standing, and the human is still rewarded', async () => {
    const code = await createRoom(solo, 'papan-bijak', { ...PB_FORM, match_mode: 'same_level' })
    await ageRoom(t, code)
    let v = parseRoom(await solo.post(P('papan-bijak', code, '/start')))
    for (let i = 0; i < 900 && v.status === 'playing'; i++) {
      t.clock.advance(1_000)
      if (v.state?.awaiting === 'roll') v = parseRoom(await solo.post(P('papan-bijak', code, '/action'), { type: 'roll' }))
      else {
        const st = await stateOf(t.db, code)
        v = parseRoom(await solo.post(P('papan-bijak', code, '/action'), { type: 'answer', questionId: st.pendingQ, optionId: (st.qs[st.pendingQ as string] as { keyIndex: number }).keyIndex }))
      }
    }
    expect(v.status).toBe('finished')
    expect(await t.db.query('select 1 from game_standings')).toHaveLength(0)
    expect((await events(code)).map((e) => e.user_id)).toEqual([solo.userId])
  }, 120_000)

  it('concurrent polls, sweeps and an action advance a timed-out turn once (one locked advance)', async () => {
    const code = await createRoom(a, 'papan-bijak', { ...PB_FORM, match_mode: 'same_level' })
    await join(b, 'papan-bijak', code)
    await ageRoom(t, code)
    const start = parseRoom(await a.post(P('papan-bijak', code, '/start')))
    const first = start.state?.humanId as string
    t.clock.advance(31_000) // the 30 s roll of the first seat ran out
    const rooms = t.app.get(RoomsService, { strict: false })
    await Promise.all([
      a.get(P('papan-bijak', code)),
      b.get(P('papan-bijak', code)),
      rooms.sweepClocks(),
      rooms.sweepClocks(),
      a.get(P('papan-bijak', code)),
      b.get(P('papan-bijak', code)),
    ])
    const st = await stateOf(t.db, code)
    expect(first).toBe(a.userId)
    expect(st.log.filter((l) => l.startsWith('roll:'))).toHaveLength(1) // one auto-roll, however many calls raced
    const again = await stateOf(t.db, code)
    await rooms.sweepClocks()
    expect(await stateOf(t.db, code)).toEqual(again) // idempotent: nothing moves twice
  }, 120_000)

  it('two identical actions at once apply once: the second finds it is no longer the seat\'s turn', async () => {
    const code = await createRoom(a, 'papan-bijak', { ...PB_FORM, match_mode: 'same_level' })
    await join(b, 'papan-bijak', code)
    parseRoom(await a.post(P('papan-bijak', code, '/start')))
    const res = await Promise.all([a.post(P('papan-bijak', code, '/action'), { type: 'roll' }), a.post(P('papan-bijak', code, '/action'), { type: 'roll' })])
    const codes = res.map((r) => r.status).sort()
    expect(codes[0]).toBe(200)
    expect([403, 409]).toContain(codes[1])
    const st = await stateOf(t.db, code)
    expect(st.log.filter((l) => l.startsWith('roll:'))).toHaveLength(1)
  }, 120_000)

  it('3 timeouts in a row with no poll in between remove the absent human: a robot takes the seat, or the last human present wins', async () => {
    const code = await createRoom(a, 'papan-bijak', { ...PB_FORM, match_mode: 'same_level' })
    await join(b, 'papan-bijak', code)
    parseRoom(await a.post(P('papan-bijak', code, '/start')))
    // b never polls again; a polls every 20 s, so a is present while b's turns time out
    let v: GamesRoomView = parseRoom(await a.get(P('papan-bijak', code)))
    for (let i = 0; i < 40 && v.status === 'playing' && v.players.every((p) => !p.isBot); i++) {
      t.clock.advance(20_000)
      v = parseRoom(await a.get(P('papan-bijak', code)))
      if (v.state?.humanId === a.userId && v.status === 'playing') {
        v = parseRoom(await a.post(P('papan-bijak', code, '/action'), v.state.awaiting === 'roll' ? { type: 'roll' } : { type: 'answer', questionId: (await stateOf(t.db, code)).pendingQ, optionId: null }))
      }
    }
    // b was alone with a: removing b leaves one human present, who wins by default
    expect(v.status).toBe('finished')
    expect(v.result?.winnerId).toBe(a.userId)
    expect(await standing('papan-bijak', b.userId)).toMatchObject({ wins: 0, jumlah: 1, betul: 0, skor: 0 })
    expect(await standing('papan-bijak', a.userId)).toMatchObject({ wins: 1, jumlah: 1 })
    expect((await events(code)).map((e) => e.user_id)).toEqual([a.userId]) // no reward for the removed seat
  }, 120_000)

  it('3 humans: one absent human (3 timeouts, no poll) is replaced by a robot and the game goes on with 2 humans', async () => {
    const code = await createRoom(a, 'papan-bijak', { ...PB_FORM, match_mode: 'same_level' })
    await join(b, 'papan-bijak', code)
    await join(solo, 'papan-bijak', code)
    parseRoom(await a.post(P('papan-bijak', code, '/start')))
    // `solo` never polls again; a and b play every turn they are waited for, so they stay present
    let v: GamesRoomView = parseRoom(await a.get(P('papan-bijak', code)))
    for (let i = 0; i < 400 && v.status === 'playing' && v.players.every((p) => !p.isBot); i++) {
      t.clock.advance(15_000)
      const turn = v.state?.humanId as string
      const actor = turn === b.userId ? b : a
      v = parseRoom(await (turn === solo.userId ? a : actor).get(P('papan-bijak', code)))
      if (v.status === 'playing' && (v.state?.humanId === a.userId || v.state?.humanId === b.userId)) {
        const c = v.state.humanId === a.userId ? a : b
        const st = await stateOf(t.db, code)
        v = parseRoom(await c.post(P('papan-bijak', code, '/action'), v.state.awaiting === 'roll' ? { type: 'roll' } : { type: 'answer', questionId: st.pendingQ, optionId: null }))
      }
      await Promise.all([a.get(P('papan-bijak', code)), b.get(P('papan-bijak', code))]) // both present
    }
    const now = parseRoom(await a.get(P('papan-bijak', code)))
    expect(now.status).toBe('playing') // 2 humans remain: the game goes on
    expect(now.players.map((p) => p.isBot).sort()).toEqual([false, false, true])
    expect(now.players.find((p) => p.id === solo.userId)).toBeUndefined()
    expect(await standing('papan-bijak', solo.userId)).toBeUndefined() // ruling 50.4: nothing is written until the game finishes settled
    const end = await playOut(code, 'papan-bijak', now)
    expect(end.status).toBe('finished')
    expect(await standing('papan-bijak', solo.userId)).toEqual({ wins: 0, jumlah: 1, skor: 0, betul: 0 }) // written once, at the settled finish
    expect(await t.db.query('select 1 from game_reward_events where user_id = $1::bigint', [solo.userId])).toHaveLength(0)
  }, 120_000)

  it('ruling 50.1: robots off, a human leaves a 3-human room: the seat is skipped (no robot), play goes on and settles for the 2 who stayed', async () => {
    await t.db.query(`update gamification_settings set value = 0 where key = 'games_room_bots_enabled'`)
    try {
      const code = await createRoom(a, 'papan-bijak', { ...PB_FORM, match_mode: 'same_level' })
      await join(b, 'papan-bijak', code)
      await join(solo, 'papan-bijak', code)
      parseRoom(await a.post(P('papan-bijak', code, '/start')))
      const start = parseRoom(await solo.post(P('papan-bijak', code, '/action'), { type: 'leave' }))
      expect(start.status).toBe('playing')
      expect(start.players).toHaveLength(2)
      expect(start.players.some((p) => p.isBot)).toBe(false)
      expect(await t.db.query('select 1 from game_room_players where room_code = $1 and (is_bot or user_id is null)', [code])).toHaveLength(0)
      const v = await playOut(code, 'papan-bijak', start)
      expect(v.status).toBe('finished')
      for (const c of [a, b]) expect(await standing('papan-bijak', c.userId)).toMatchObject({ jumlah: 1 })
      expect(await standing('papan-bijak', solo.userId)).toEqual({ wins: 0, jumlah: 1, skor: 0, betul: 0 })
      expect((await events(code)).map((e) => e.user_id).sort()).toEqual([a.userId, b.userId].sort())
    } finally {
      await t.db.query(`update gamification_settings set value = 1 where key = 'games_room_bots_enabled'`)
    }
  }, 120_000)

  /** Rounds of 15 s: a and b act on their turns and everybody polls; `idle` polls every round but never acts. Stops when `idle` is gone. */
  async function playWithIdlePoller(code: string, idle: Client, polls = true): Promise<GamesRoomView> {
    let v: GamesRoomView = parseRoom(await a.get(P('papan-bijak', code)))
    for (let i = 0; i < 400 && v.status === 'playing' && v.players.some((p) => p.id === idle.userId); i++) {
      t.clock.advance(15_000)
      if (polls) await idle.get(P('papan-bijak', code)) // present, polling every round, never acting
      v = parseRoom(await a.get(P('papan-bijak', code)))
      if (v.status === 'playing' && (v.state?.humanId === a.userId || v.state?.humanId === b.userId)) {
        const c = v.state.humanId === a.userId ? a : b
        const st = await stateOf(t.db, code)
        v = parseRoom(await c.post(P('papan-bijak', code, '/action'), v.state.awaiting === 'roll' ? { type: 'roll' } : { type: 'answer', questionId: st.pendingQ, optionId: (st.qs[st.pendingQ as string] as { keyIndex: number }).keyIndex }))
      }
      await b.get(P('papan-bijak', code))
    }
    return parseRoom(await a.get(P('papan-bijak', code)))
  }

  it('ruling 50.1: robots off, an absent human (3 timeouts) is skipped the same way', async () => {
    await t.db.query(`update gamification_settings set value = 0 where key = 'games_room_bots_enabled'`)
    try {
      const code = await createRoom(a, 'papan-bijak', { ...PB_FORM, match_mode: 'same_level' })
      await join(b, 'papan-bijak', code)
      await join(solo, 'papan-bijak', code)
      parseRoom(await a.post(P('papan-bijak', code, '/start')))
      const v = await playWithIdlePoller(code, solo, false) // solo never polls; a and b play their turns
      expect(v.status).toBe('playing')
      expect(v.players.map((p) => p.id).sort()).toEqual([a.userId, b.userId].sort())
      expect(v.players.some((p) => p.isBot)).toBe(false)
    } finally {
      await t.db.query(`update gamification_settings set value = 1 where key = 'games_room_bots_enabled'`)
    }
  }, 120_000)

  it('ruling 49.1 (lead Q3): a human who polls every turn but never acts is still removed after 3 timeouts: a robot takes the seat', async () => {
    const code = await createRoom(a, 'papan-bijak', { ...PB_FORM, match_mode: 'same_level' })
    await join(b, 'papan-bijak', code)
    await join(solo, 'papan-bijak', code)
    parseRoom(await a.post(P('papan-bijak', code, '/start')))
    const v = await playWithIdlePoller(code, solo)
    expect(v.status).toBe('playing')
    expect(v.players.find((p) => p.id === solo.userId)).toBeUndefined()
    expect(v.players.map((p) => p.isBot).sort()).toEqual([false, false, true])
    expect(await standing('papan-bijak', solo.userId)).toBeUndefined() // not written while the game is in play
    const end = await playOut(code, 'papan-bijak', v)
    expect(end.status).toBe('finished')
    expect(await standing('papan-bijak', solo.userId)).toEqual({ wins: 0, jumlah: 1, skor: 0, betul: 0 })
    for (const c of [a, b]) {
      const mine = end.result?.scores.find((x) => x.userId === c.userId)
      expect(await standing('papan-bijak', c.userId)).toEqual({ wins: end.result?.winnerId === c.userId ? 1 : 0, jumlah: 1, skor: mine?.points, betul: mine?.correct })
    }
  }, 120_000)

  it('ruling 49.1: the same idle poller with robots off is skipped, not replaced', async () => {
    await t.db.query(`update gamification_settings set value = 0 where key = 'games_room_bots_enabled'`)
    try {
      const code = await createRoom(a, 'papan-bijak', { ...PB_FORM, match_mode: 'same_level' })
      await join(b, 'papan-bijak', code)
      await join(solo, 'papan-bijak', code)
      parseRoom(await a.post(P('papan-bijak', code, '/start')))
      const v = await playWithIdlePoller(code, solo)
      expect(v.status).toBe('playing')
      expect(v.players.map((p) => p.id).sort()).toEqual([a.userId, b.userId].sort())
      expect(v.players.some((p) => p.isBot)).toBe(false)
      expect(await standing('papan-bijak', solo.userId)).toBeUndefined() // the skipped seat's jumlah waits for the settled finish
      const end = await playOut(code, 'papan-bijak', v)
      expect(end.status).toBe('finished')
      expect(await standing('papan-bijak', solo.userId)).toEqual({ wins: 0, jumlah: 1, skor: 0, betul: 0 })
      for (const c of [a, b]) {
        const mine = end.result?.scores.find((x) => x.userId === c.userId)
        expect(await standing('papan-bijak', c.userId)).toEqual({ wins: end.result?.winnerId === c.userId ? 1 : 0, jumlah: 1, skor: mine?.points, betul: mine?.correct })
      }
    } finally {
      await t.db.query(`update gamification_settings set value = 1 where key = 'games_room_bots_enabled'`)
    }
  }, 120_000)

  it('ruling 49.1: with two humans, the one who only polls is removed and the other (present) wins by default', async () => {
    const code = await createRoom(a, 'papan-bijak', { ...PB_FORM, match_mode: 'same_level' })
    await join(b, 'papan-bijak', code)
    parseRoom(await a.post(P('papan-bijak', code, '/start')))
    let v: GamesRoomView = parseRoom(await a.get(P('papan-bijak', code)))
    for (let i = 0; i < 80 && v.status === 'playing'; i++) {
      t.clock.advance(15_000)
      await b.get(P('papan-bijak', code)) // b polls every round and never acts
      v = parseRoom(await a.get(P('papan-bijak', code)))
      if (v.status === 'playing' && v.state?.humanId === a.userId) {
        const st = await stateOf(t.db, code)
        v = parseRoom(await a.post(P('papan-bijak', code, '/action'), v.state.awaiting === 'roll' ? { type: 'roll' } : { type: 'answer', questionId: st.pendingQ, optionId: (st.qs[st.pendingQ as string] as { keyIndex: number }).keyIndex }))
      }
    }
    expect(v.status).toBe('finished')
    expect(v.result?.winnerId).toBe(a.userId)
    expect(await standing('papan-bijak', b.userId)).toEqual({ wins: 0, jumlah: 1, skor: 0, betul: 0 })
    const mineA = v.result?.scores.find((x) => x.userId === a.userId)
    expect(await standing('papan-bijak', a.userId)).toEqual({ wins: 1, jumlah: 1, skor: mineA?.points, betul: mineA?.correct })
  }, 120_000)

  it.each([1, 0])('ruling 50.3/50.4: three humans all go away (bots %i), only the sweep runs: A replaced or skipped, then B removed, C absent: nothing settled and no standing for A, B or C', async (bots) => {
    await t.db.query(`update gamification_settings set value = ${String(bots)} where key = 'games_room_bots_enabled'`)
    try {
      const code = await createRoom(a, 'papan-bijak', { ...PB_FORM, match_mode: 'same_level' })
      await join(b, 'papan-bijak', code)
      await join(solo, 'papan-bijak', code)
      parseRoom(await a.post(P('papan-bijak', code, '/start')))
      const rooms = t.app.get(RoomsService, { strict: false })
      for (let i = 0; i < 80; i++) {
        t.clock.advance(31_000)
        await rooms.sweepClocks()
        if ((await t.db.query<{ status: string }>('select status from game_rooms where code = $1', [code]))[0]?.status !== 'playing') break
      }
      const room = (await t.db.query<{ status: string; settled_at: Date | null }>('select status, settled_at from game_rooms where code = $1', [code]))[0]
      expect(room?.status).toBe('finished')
      expect(room?.settled_at).not.toBeNull()
      expect(await t.db.query('select 1 from game_standings')).toHaveLength(0) // not for A, not for B, not for C
      expect(await events(code)).toHaveLength(0)
    } finally {
      await t.db.query(`update gamification_settings set value = 1 where key = 'games_room_bots_enabled'`)
    }
  }, 120_000)

  it('ruling 50.3: a lone human who is absent (3 timeouts, the sweep runs) ends the game with nothing settled', async () => {
    const code = await createRoom(solo, 'perang-fakta', FORM)
    await ageRoom(t, code)
    parseRoom(await solo.post(P('perang-fakta', code, '/start')))
    t.clock.advance(35_000)
    await t.app.get(RoomsService, { strict: false }).sweepClocks()
    const room = (await t.db.query<{ status: string; settled_at: Date | null }>('select status, settled_at from game_rooms where code = $1', [code]))[0]
    expect(room?.status).toBe('finished')
    expect(room?.settled_at).not.toBeNull()
    expect(await events(code)).toHaveLength(0)
    expect(await t.db.query('select 1 from game_standings')).toHaveLength(0)
  }, 120_000)
})
