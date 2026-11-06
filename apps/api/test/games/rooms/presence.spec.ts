import type { GamesRoomView } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCOUNTS, bootGamesApp, loginAs, START, type Client, type GamesTestApp } from '../helpers'
import { RoomsRepository } from '../../../src/modules/games/rooms/rooms.repository'
import { RoomSecrets } from '../../../src/modules/games/rooms/room-secrets'
import { RoomsService } from '../../../src/modules/games/rooms/rooms.service'
import { P, PB_FORM, createRoom, parseRoom, stateOf } from './support'

/**
 * S7-T01 part GAME-R, R3 (DM-90, rulings 49 and 54): seat presence lives in `game_room_players.last_polled_at` and
 * `consecutive_timeouts`. Poll writes it (at most every 5 s), an action writes it and resets the count, a timeout adds one,
 * 3 remove the seat, and an absent seat's turn closes at games_absent_seconds instead of the full clock.
 */
const PINNED_SEED = 'ab12cd34ef56ab12cd34ef56ab12cd34'

describe('room seat presence (R3)', () => {
  let t: GamesTestApp
  let a: Client
  let b: Client
  let solo: Client

  beforeAll(async () => {
    t = await bootGamesApp({ withGamification: true })
    const { insertShortMcqs } = await import('./support')
    await insertShortMcqs(t.db, { subject: 'MATH', level: 'T4', count: 60, prefix: 'PR' })
    a = await loginAs(t, ACCOUNTS.student)
    b = await loginAs(t, ACCOUNTS.student2)
    solo = await loginAs(t, ACCOUNTS.teacher)
    await t.db.query(`update gamification_settings set value = 0 where key = 'games_min_ms_per_answer'`)
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    t.clock.set(START)
    await t.db.query("update game_rooms set status = 'closed' where status = 'playing'")
  })

  const seatOf = async (code: string, c: Client) =>
    (
      await t.db.query<{ last_polled_at: Date | null; consecutive_timeouts: number }>(
        'select last_polled_at, consecutive_timeouts from game_room_players where room_code = $1 and user_id = $2::bigint',
        [code, c.userId],
      )
    )[0]
  const startRoom = async (): Promise<{ code: string; view: GamesRoomView }> => {
    const code = await createRoom(a, 'papan-bijak', { ...PB_FORM, match_mode: 'same_level' })
    await b.post(P('papan-bijak', undefined, '/join'), { room_code: code })
    return { code, view: parseRoom(await a.post(P('papan-bijak', code, '/start'))) }
  }
  const setAbsent = (seconds: number) => t.db.query(`update gamification_settings set value = ${String(seconds)} where key = 'games_absent_seconds'`)

  it('start marks every human seat present now with no timeouts', async () => {
    const { code } = await startRoom()
    for (const c of [a, b]) {
      const s = await seatOf(code, c)
      expect(s?.last_polled_at?.getTime()).toBe(new Date(START).getTime())
      expect(s?.consecutive_timeouts).toBe(0)
    }
  })

  it('a poll writes last_polled_at at most every 5 s per seat; the state document no longer holds presence', async () => {
    const { code } = await startRoom()
    t.clock.advance(4_000)
    await b.get(P('papan-bijak', code))
    expect((await seatOf(code, b))?.last_polled_at?.getTime()).toBe(new Date(START).getTime()) // inside the gap: not written
    t.clock.advance(1_000)
    await b.get(P('papan-bijak', code))
    expect((await seatOf(code, b))?.last_polled_at?.getTime()).toBe(new Date(START).getTime() + 5_000)
    expect((await seatOf(code, a))?.last_polled_at?.getTime()).toBe(new Date(START).getTime()) // a did not poll
    const st = await stateOf(t.db, code)
    expect(JSON.stringify(st.seats)).not.toMatch(/seenMs|missed/)
  })

  it('an action writes last_polled_at and sets consecutive_timeouts to 0', async () => {
    const { code, view } = await startRoom()
    const on = view.state?.humanId === a.userId ? a : b
    await t.db.query('update game_room_players set consecutive_timeouts = 2 where room_code = $1 and user_id = $2::bigint', [code, on.userId])
    t.clock.advance(2_000)
    parseRoom(await on.post(P('papan-bijak', code, '/action'), { type: 'roll' }))
    const s = await seatOf(code, on)
    expect(s?.consecutive_timeouts).toBe(0)
    expect(s?.last_polled_at?.getTime()).toBe(new Date(START).getTime() + 2_000)
  })

  it('a seat that keeps polling but never acts: its count rises with each timeout while it is present, and it is removed at 3', async () => {
    const { code } = await startRoom()
    const seen: number[] = []
    let v: GamesRoomView = parseRoom(await a.get(P('papan-bijak', code)))
    for (let i = 0; i < 60 && v.status === 'playing'; i++) {
      t.clock.advance(15_000)
      await b.get(P('papan-bijak', code)) // b polls every round, never acts
      v = parseRoom(await a.get(P('papan-bijak', code)))
      const mine = await seatOf(code, b)
      if (mine) {
        seen.push(mine.consecutive_timeouts)
        expect(new Date(START).getTime() + 15_000 * (i + 1) - (mine.last_polled_at?.getTime() ?? 0)).toBeLessThanOrEqual(5_000 + 15_000) // polled, so present
      }
      if (v.status === 'playing' && v.state?.humanId === a.userId) {
        const st = await stateOf(t.db, code)
        v = parseRoom(await a.post(P('papan-bijak', code, '/action'), v.state.awaiting === 'roll' ? { type: 'roll' } : { type: 'answer', questionId: st.pendingQ, optionId: (st.qs[st.pendingQ as string] as { keyIndex: number }).keyIndex }))
      }
    }
    expect(Math.max(...seen)).toBeGreaterThanOrEqual(1) // it was counted while polling
    expect(Math.max(...seen)).toBeLessThanOrEqual(2) // and never sat at 3
    expect(v.status).toBe('finished') // 1 human left and present: default win
    expect(v.result?.winnerId).toBe(a.userId)
    expect(await seatOf(code, b)).toBeUndefined() // the seat is gone
  }, 120_000)

  it('an absent seat\'s turn closes at games_absent_seconds, not the full clock; a seat that polls runs the full 30 s roll clock', async () => {
    await setAbsent(10) // the limit as presence reads it is 15 s (10 + the 5 s write gap)
    try {
      const { code, view } = await startRoom()
      const first = view.state?.humanId === a.userId ? a : b
      const other = first === a ? b : a
      t.clock.advance(8_000)
      await other.get(P('papan-bijak', code)) // the seat NOT on turn polls; the seat on turn does not
      t.clock.advance(6_000) // 14 s: inside the limit
      await other.get(P('papan-bijak', code))
      expect((await stateOf(t.db, code)).log.filter((l) => l.startsWith('roll:'))).toHaveLength(0)
      expect((await seatOf(code, first))?.consecutive_timeouts).toBe(0)
      t.clock.advance(1_000) // 15 s: the absent seat's turn closes now, 15 s before the roll clock would
      await other.get(P('papan-bijak', code))
      expect((await stateOf(t.db, code)).log.filter((l) => l.startsWith('roll:')).length).toBeGreaterThanOrEqual(1)
      expect((await seatOf(code, first))?.consecutive_timeouts).toBeGreaterThanOrEqual(1)

      // a seat that keeps polling is present: its turn runs the whole clock
      const second = await startRoom()
      const on = second.view.state?.humanId === a.userId ? a : b
      for (const s of [8, 8, 8, 5]) {
        t.clock.advance(s * 1_000)
        await on.get(P('papan-bijak', second.code)) // 29 s in, polled every 8 s
      }
      expect((await stateOf(t.db, second.code)).log.filter((l) => l.startsWith('roll:'))).toHaveLength(0)
      t.clock.advance(1_000) // 30 s: the full clock
      await on.get(P('papan-bijak', second.code))
      expect((await stateOf(t.db, second.code)).log.filter((l) => l.startsWith('roll:')).length).toBeGreaterThanOrEqual(1)
    } finally {
      await setAbsent(30)
    }
  }, 120_000)

  /** The seat on turn acts until the turn is `id`'s (or the game ends). */
  async function playUntil(code: string, id: string, who: Record<string, Client>): Promise<GamesRoomView> {
    let v: GamesRoomView = parseRoom(await a.get(P('papan-bijak', code)))
    for (let i = 0; i < 20 && v.status === 'playing' && v.state?.humanId !== id; i++) {
      const c = who[v.state?.humanId as string] as Client
      const st = await stateOf(t.db, code)
      v = parseRoom(await c.post(P('papan-bijak', code, '/action'), v.state?.awaiting === 'roll' ? { type: 'roll' } : { type: 'answer', questionId: st.pendingQ, optionId: (st.qs[st.pendingQ as string] as { keyIndex: number }).keyIndex }))
    }
    return v
  }

  it('Major 2: a seat with 2 timeouts that returns after 40 s of silence, while its own turn is open, stays seated and can act', async () => {
    const { code } = await startRoom()
    const first = a // the host is on turn first
    t.clock.advance(25_000)
    const v = await playUntil(code, b.userId, { [a.userId]: first, [b.userId]: b })
    expect(v.state?.humanId).toBe(b.userId) // b's turn begins now, at 25 s; b last polled at the start
    await t.db.query('update game_room_players set consecutive_timeouts = 2 where room_code = $1 and user_id = $2::bigint', [code, b.userId])
    t.clock.advance(20_000) // 45 s since b last polled (over the 35 s limit), its roll turn is 20 s old: open
    const back = parseRoom(await b.get(P('papan-bijak', code)))
    expect(back.status).toBe('playing')
    expect(back.players.some((p) => p.id === b.userId && !p.isBot)).toBe(true)
    expect(back.state?.humanId).toBe(b.userId)
    expect((await seatOf(code, b))?.consecutive_timeouts).toBe(2) // no third timeout on the request that shows it is back
    const acted = parseRoom(await b.post(P('papan-bijak', code, '/action'), { type: 'roll' }))
    expect(acted.status).toBe('playing')
    expect((await seatOf(code, b))?.consecutive_timeouts).toBe(0)
  }, 120_000)

  it('Major 2: a returning seat that already missed 3 turns whose clock ran out is removed on return (default win for the present one)', async () => {
    const { code, view } = await startRoom()
    const on = view.state?.humanId === a.userId ? a : b
    const other = on === a ? b : a
    await t.db.query('update game_room_players set consecutive_timeouts = 2 where room_code = $1 and user_id = $2::bigint', [code, on.userId])
    t.clock.advance(31_000) // the roll clock of the seat on turn ran out before this request
    await other.get(P('papan-bijak', code))
    const v = parseRoom(await other.get(P('papan-bijak', code)))
    expect(v.status).toBe('finished')
    expect(v.result?.winnerId).toBe(other.userId)
  }, 120_000)

  it('legacy room: columns null and the state JSON still holds seenMs/missed: no instant timeout, no crash', async () => {
    await setAbsent(10) // a null last_polled_at must not fall back to the start (15 s window) and time the first turn out
    try {
      const { code, view } = await startRoom()
      const st = await stateOf(t.db, code)
      for (const id of Object.keys(st.seats ?? {})) Object.assign(st.seats?.[id] as object, { seenMs: 1, missed: 2 })
      await t.db.query('update game_rooms set state = $2::jsonb where code = $1', [code, JSON.stringify(st)])
      await t.db.query('update game_room_players set last_polled_at = null, consecutive_timeouts = 0 where room_code = $1', [code])
      t.clock.advance(16_000)
      const r = await b.get(P('papan-bijak', code))
      expect(r.status).toBe(200)
      const now = await stateOf(t.db, code)
      expect(now.log.filter((l) => l.startsWith('roll:'))).toHaveLength(0)
      expect(now.humanId).toBe(view.state?.humanId)
      for (const c of [a, b]) expect((await seatOf(code, c))?.consecutive_timeouts).toBe(0)
    } finally {
      await setAbsent(30)
    }
  }, 120_000)

  it.each([1, 0])('3 timeouts remove a seat with 2 humans left (bots %i): a robot takes the seat, or it is skipped when robots are off', async (bots) => {
    await t.db.query(`update gamification_settings set value = ${String(bots)} where key = 'games_room_bots_enabled'`)
    try {
      // The dice and the question order come from the room's secret seed, which is random per room: pin it, or one
      // run in N lets a and b (who play every turn of theirs here) reach tile 50 before solo's third timeout.
      const pin = vi.spyOn(t.app.get(RoomSecrets, { strict: false }), 'newSeed').mockReturnValue(PINNED_SEED)
      const code = await createRoom(a, 'papan-bijak', { ...PB_FORM, match_mode: 'same_level' })
      pin.mockRestore()
      await b.post(P('papan-bijak', undefined, '/join'), { room_code: code })
      await solo.post(P('papan-bijak', undefined, '/join'), { room_code: code })
      parseRoom(await a.post(P('papan-bijak', code, '/start')))
      const who = { [a.userId]: a, [b.userId]: b }
      let v: GamesRoomView = parseRoom(await a.get(P('papan-bijak', code)))
      for (let i = 0; i < 400 && v.status === 'playing' && v.players.length === 3 && !v.players.some((p) => p.isBot); i++) {
        t.clock.advance(15_000)
        await b.get(P('papan-bijak', code))
        v = parseRoom(await a.get(P('papan-bijak', code))) // solo never polls or acts; a and b play their turns
        // only while solo is still seated: once it is removed there is no turn of solo's to play up to, and playUntil
        // would keep a and b acting (up to 20 actions) on a two-human board, which can finish the game
        const soloSeated = v.players.length === 3 && !v.players.some((p) => p.isBot)
        if (soloSeated && v.status === 'playing' && v.state?.humanId !== solo.userId && v.state && who[v.state.humanId]) v = await playUntil(code, solo.userId, who)
      }
      const rows = await t.db.query<{ user_id: string | null; is_bot: boolean; consecutive_timeouts: number }>(
        'select user_id::text, is_bot, consecutive_timeouts from game_room_players where room_code = $1 order by id',
        [code],
      )
      expect(v.status).toBe('playing')
      expect(rows.filter((r) => !r.is_bot).map((r) => r.user_id).sort()).toEqual([a.userId, b.userId].sort())
      expect(rows.some((r) => r.user_id === solo.userId)).toBe(false)
      if (bots === 1) {
        expect(rows).toHaveLength(3)
        expect(rows.filter((r) => r.is_bot)).toEqual([{ user_id: null, is_bot: true, consecutive_timeouts: 0 }]) // the seat became a robot
      } else {
        expect(rows).toHaveLength(2) // skipped: no robot, no seat
      }
    } finally {
      await t.db.query(`update gamification_settings set value = 1 where key = 'games_room_bots_enabled'`)
    }
  }, 120_000)

  it('the sweep still fires for a room with no poller; a poll bumps updated_at so a room with a poller is left to its pollers', async () => {
    const { code } = await startRoom()
    const rooms = t.app.get(RoomsService, { strict: false })
    const repo = t.app.get(RoomsRepository, { strict: false })
    const idle = async (): Promise<string[]> => repo.playingIdleSince(new Date(t.clock.now().getTime() - 10_000), 200)
    t.clock.advance(6_000)
    await b.get(P('papan-bijak', code)) // a poll: last_polled_at and updated_at move
    t.clock.advance(8_000) // 8 s since the poll, 14 s since start
    expect(await idle()).not.toContain(code)
    t.clock.advance(2_000) // 10 s since the poll: no poller any more
    expect(await idle()).toContain(code)
    t.clock.advance(25_000) // the roll clock of the seat on turn has run out
    expect(await rooms.sweepClocks()).toBeGreaterThanOrEqual(1)
    expect((await stateOf(t.db, code)).log.filter((l) => l.startsWith('roll:')).length).toBeGreaterThanOrEqual(1)
  }, 120_000)
})
