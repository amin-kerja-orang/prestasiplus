import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bareUser, bootWalletApp, type WalletTestApp } from './helpers'

interface StreakSql {
  current: number
  best: number
  last_activity_date: string | null
  total_days: number
}

describe('StreakService (AC3): streak by Malaysia day', () => {
  let t: WalletTestApp
  let n = 0
  const fresh = () => bareUser(t, `streak ${String(n++)}`)
  const row = async (userId: string): Promise<StreakSql | undefined> =>
    (await t.db.query<StreakSql>(`select current, best, last_activity_date::text, total_days from streaks where user_id = $1`, [userId]))[0]

  beforeAll(async () => {
    t = await bootWalletApp()
  })
  afterAll(async () => {
    await t.close()
  })

  it('a user without a row reads 0 / 0 / null / 0 and multiplier 1; a read creates nothing', async () => {
    const u = await fresh()
    expect(await t.streak.get(u)).toEqual({ current: 0, best: 0, lastActivityDate: null, totalDays: 0, multiplier: 1 })
    expect(await row(u)).toBeUndefined()
  })

  it('the first activity starts the streak at 1 on today (Malaysia day of the Clock)', async () => {
    const u = await fresh()
    t.clock.set('2026-10-19T09:00:00+08:00')
    expect(await t.streak.touch(u)).toEqual({ current: 1, best: 1, lastActivityDate: '2026-10-19', totalDays: 1, multiplier: 1, changed: true })
    expect(await row(u)).toEqual({ current: 1, best: 1, last_activity_date: '2026-10-19', total_days: 1 })
  })

  it('the same Malaysia day leaves the streak unchanged, from the first to the last second of the day', async () => {
    const u = await fresh()
    t.clock.set('2026-10-19T00:00:00+08:00')
    await t.streak.touch(u)
    t.clock.set('2026-10-19T23:59:59+08:00')
    const again = await t.streak.touch(u)
    expect(again).toMatchObject({ current: 1, best: 1, totalDays: 1, changed: false })
    expect(await row(u)).toEqual({ current: 1, best: 1, last_activity_date: '2026-10-19', total_days: 1 })
  })

  it('boundary: 23:59:59 and 00:00:00 Asia/Kuala_Lumpur are two consecutive days', async () => {
    const u = await fresh()
    t.clock.set('2026-10-19T23:59:59+08:00')
    expect(await t.streak.touch(u)).toMatchObject({ current: 1, lastActivityDate: '2026-10-19' })
    t.clock.advance(1000) // 2026-10-20T00:00:00+08:00
    expect(t.clock.now().toISOString()).toBe('2026-10-19T16:00:00.000Z')
    expect(await t.streak.touch(u)).toMatchObject({ current: 2, best: 2, lastActivityDate: '2026-10-20', totalDays: 2, changed: true })
  })

  it('the day is the Malaysia day, not the UTC day', async () => {
    const u = await fresh()
    t.clock.set('2026-10-19T15:59:59Z') // 23:59:59 on the 19th in Malaysia, still the 19th in UTC
    expect((await t.streak.touch(u)).lastActivityDate).toBe('2026-10-19')
    t.clock.set('2026-10-19T16:00:00Z') // 00:00:00 on the 20th in Malaysia, the 19th in UTC
    expect((await t.streak.touch(u)).lastActivityDate).toBe('2026-10-20')
    t.clock.set('2026-10-20T07:59:59Z') // 15:59:59 on the 20th
    expect(await t.streak.touch(u)).toMatchObject({ current: 2, changed: false })
  })

  it('a gap of one missed day restarts at 1; best keeps the maximum; totalDays counts each new streak day', async () => {
    const u = await fresh()
    for (const day of ['2026-10-10', '2026-10-11', '2026-10-12']) {
      t.clock.set(`${day}T10:00:00+08:00`)
      await t.streak.touch(u)
    }
    expect(await row(u)).toEqual({ current: 3, best: 3, last_activity_date: '2026-10-12', total_days: 3 })
    t.clock.set('2026-10-14T10:00:00+08:00') // 13th missed
    expect(await t.streak.touch(u)).toMatchObject({ current: 1, best: 3, lastActivityDate: '2026-10-14', totalDays: 4 })
    t.clock.set('2026-10-15T10:00:00+08:00')
    expect(await t.streak.touch(u)).toMatchObject({ current: 2, best: 3, totalDays: 5 })
  })

  it('best rises with the streak and reads never decay a stale streak', async () => {
    const u = await fresh()
    for (let d = 1; d <= 5; d++) {
      t.clock.set(`2026-09-${String(d).padStart(2, '0')}T08:00:00+08:00`)
      await t.streak.touch(u)
    }
    t.clock.set('2026-10-19T09:00:00+08:00')
    expect(await t.streak.get(u)).toMatchObject({ current: 5, best: 5, lastActivityDate: '2026-09-05' }) // 6 weeks later: unchanged
  })

  it('month and year boundaries are consecutive days', async () => {
    const u = await fresh()
    t.clock.set('2026-12-31T20:00:00+08:00')
    await t.streak.touch(u)
    t.clock.set('2027-01-01T06:00:00+08:00')
    expect(await t.streak.touch(u)).toMatchObject({ current: 2, lastActivityDate: '2027-01-01' })
  })

  it('an explicit `at` (the completion time of a session) decides the day, not the Clock', async () => {
    const u = await fresh()
    t.clock.set('2026-10-19T09:00:00+08:00')
    expect(await t.streak.touch(u, { at: new Date('2026-10-17T20:00:00+08:00') })).toMatchObject({ current: 1, lastActivityDate: '2026-10-17' })
    expect(await t.streak.touch(u, { at: new Date('2026-10-18T20:00:00+08:00') })).toMatchObject({ current: 2, lastActivityDate: '2026-10-18' })
    await expect(t.streak.touch(u, { at: new Date('nope') })).rejects.toThrow(RangeError)
  })

  it('concurrent touches on one day count the day once', async () => {
    const u = await fresh()
    t.clock.set('2026-10-19T09:00:00+08:00')
    const all = await Promise.all(Array.from({ length: 8 }, () => t.streak.touch(u)))
    expect(all.filter((r) => r.changed)).toHaveLength(1)
    expect(await row(u)).toEqual({ current: 1, best: 1, last_activity_date: '2026-10-19', total_days: 1 })
  })

  it('is atomic with the caller transaction', async () => {
    const u = await fresh()
    t.clock.set('2026-10-19T09:00:00+08:00')
    await expect(
      t.prisma.transaction(async () => {
        await t.streak.touch(u)
        throw new Error('caller failed')
      }),
    ).rejects.toThrow('caller failed')
    expect(await row(u)).toBeUndefined()
  })

  it('rejects a malformed user id', async () => {
    await expect(t.streak.touch('x1')).rejects.toThrow(RangeError)
    await expect(t.streak.get('')).rejects.toThrow(RangeError)
  })

  describe('daily login mark (BR-M14-14)', () => {
    it('the first call of a Malaysia day is true, later calls of the same day are false, the next day is true again', async () => {
      const u = await fresh()
      t.clock.set('2026-10-19T00:00:00+08:00')
      expect(await t.streak.markDailyLogin(u)).toEqual({ firstToday: true, day: '2026-10-19' })
      t.clock.set('2026-10-19T23:59:59+08:00')
      expect(await t.streak.markDailyLogin(u)).toEqual({ firstToday: false, day: '2026-10-19' })
      t.clock.set('2026-10-20T00:00:00+08:00')
      expect(await t.streak.markDailyLogin(u)).toEqual({ firstToday: true, day: '2026-10-20' })
      const marks = await t.db.query<{ mark_date: string }>(`select mark_date::text from daily_login_marks where user_id = $1 order by 1`, [u])
      expect(marks.map((m) => m.mark_date)).toEqual(['2026-10-19', '2026-10-20'])
    })

    it('concurrent logins of one day mark once', async () => {
      const u = await fresh()
      t.clock.set('2026-10-19T09:00:00+08:00')
      const all = await Promise.all(Array.from({ length: 6 }, () => t.streak.markDailyLogin(u)))
      expect(all.filter((r) => r.firstToday)).toHaveLength(1)
    })
  })
})
