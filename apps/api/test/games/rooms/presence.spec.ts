import type { GamesRoomView } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { ACCOUNTS, bootGamesApp, loginAs, START, type Client, type GamesTestApp } from '../helpers'
import { P, PB_FORM, createRoom, parseRoom, stateOf } from './support'

/**
 * S7-T01 part GAME-R, R3 (DM-90, rulings 49 and 54): seat presence lives in `game_room_players.last_polled_at` and
 * `consecutive_timeouts`. Poll writes it (at most every 5 s), an action writes it and resets the count, a timeout adds one,
 * 3 remove the seat, and an absent seat's turn closes at games_absent_seconds instead of the full clock.
 */
describe('room seat presence (R3)', () => {
  let t: GamesTestApp
  let a: Client
  let b: Client

  beforeAll(async () => {
    t = await bootGamesApp({ withGamification: true })
    const { insertShortMcqs } = await import('./support')
    await insertShortMcqs(t.db, { subject: 'MATH', level: 'T4', count: 60, prefix: 'PR' })
    a = await loginAs(t, ACCOUNTS.student)
    b = await loginAs(t, ACCOUNTS.student2)
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
})
