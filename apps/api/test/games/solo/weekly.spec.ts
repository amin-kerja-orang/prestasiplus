import { GAMES_MESSAGES, GamesUjiMindaSchema, GamesWeeklyCompetitionSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { WeeklyPracticeRow, WeeklyPracticeSource } from '../../../src/modules/games'
import { ACCOUNTS, bootGamesApp, expectError, loginAs, parseData, START, type GamesTestApp } from '../helpers'

const M = GAMES_MESSAGES

/** A bound double: 25 ranked rows (with an extra personal field that must never reach the response) and a fixed "me". */
class FakeWeekly implements WeeklyPracticeSource {
  readonly calls: { userId: string; from: Date; to: Date }[] = []
  async week(userId: string, from: Date, to: Date) {
    this.calls.push({ userId, from, to })
    const rows = Array.from({ length: 25 }, (_, i) => ({
      rank: i + 1,
      userId: String(1000 + i),
      name: `Murid Contoh ${String(i + 1)}`,
      sesi: 30 - i,
      betul: 300 - i * 5,
      tepat: 90 - i,
      email: `murid${String(i)}@example.test`,
    })) as unknown as WeeklyPracticeRow[]
    return { me: { rank: 7, betul: 270 }, rows }
  }
}

describe('weekly competition and Uji Minda (M16-40, M16-41)', () => {
  describe('default port (empty board)', () => {
    let t: GamesTestApp
    beforeAll(async () => {
      t = await bootGamesApp()
    })
    afterAll(async () => {
      await t.close()
    })

    it('401 without a session', async () => {
      expectError(await t.http().get('/api/games/pertandingan'), 'UNAUTHORIZED', M.unauthenticated)
      expectError(await t.http().get('/api/games/uji-minda'), 'UNAUTHORIZED', M.unauthenticated)
    })

    it('an empty board in the current Malaysia week (Monday 19 to Sunday 25 October 2026), prizes 100/50/25', async () => {
      const c = await loginAs(t, ACCOUNTS.student)
      const board = parseData(await c.get('/api/games/pertandingan'), GamesWeeklyCompetitionSchema)
      expect(board).toEqual({ weekStart: '2026-10-19', weekEnd: '2026-10-25', endsAt: '2026-10-25T23:59:59.000+08:00', prizes: [100, 50, 25], me: null, rows: [] })
    })

    it('Uji Minda is the constant { challenge: null } for every role', async () => {
      for (const email of [ACCOUNTS.student, ACCOUNTS.teacher, ACCOUNTS.admin]) {
        const c = await loginAs(t, email)
        const res = await c.get('/api/games/uji-minda')
        expect(parseData(res, GamesUjiMindaSchema)).toEqual({ challenge: null })
        expect(res.body).toEqual({ data: { challenge: null } })
      }
    })
  })

  describe('with a bound weekly source', () => {
    let t: GamesTestApp
    const weekly = new FakeWeekly()
    beforeAll(async () => {
      t = await bootGamesApp({ ports: { weeklyPractice: weekly } })
    })
    afterAll(async () => {
      await t.close()
    })

    it('top 20 rows with the contract fields only, me, the week in MYT, ?week= ignored', async () => {
      const c = await loginAs(t, ACCOUNTS.student)
      const res = await c.get('/api/games/pertandingan?week=2020-01-06')
      const board = parseData(res, GamesWeeklyCompetitionSchema)
      expect(board.rows).toHaveLength(20)
      // the fake ids are no users of the system: outsiders, so redacted (children's names rule, issue #76)
      expect(board.rows[0]).toEqual({ rank: 1, userId: null, name: 'Murid C.', sesi: 30, betul: 300, tepat: 90 })
      expect(board.me).toEqual({ rank: 7, betul: 270 })
      expect(board.weekStart).toBe('2026-10-19')
      expect(JSON.stringify(res.body)).not.toContain('email')
      const call = weekly.calls.at(-1)
      expect(call?.userId).toBe(c.userId)
      expect(call?.from.toISOString()).toBe('2026-10-18T16:00:00.000Z') // Monday 00:00 +08:00
      expect(call?.to.toISOString()).toBe('2026-10-25T15:59:59.000Z') // Sunday 23:59:59 +08:00
    })

    it('the week turns over at Monday 00:00 Malaysia time', async () => {
      t.clock.set('2026-10-25T23:59:30+08:00')
      const c = await loginAs(t, ACCOUNTS.student)
      expect(parseData(await c.get('/api/games/pertandingan'), GamesWeeklyCompetitionSchema).weekStart).toBe('2026-10-19')
      t.clock.set('2026-10-26T00:00:00+08:00')
      const next = parseData(await c.get('/api/games/pertandingan'), GamesWeeklyCompetitionSchema)
      expect(next).toMatchObject({ weekStart: '2026-10-26', weekEnd: '2026-11-01', endsAt: '2026-11-01T23:59:59.000+08:00' })
      t.clock.set(START)
    })
  })
})
