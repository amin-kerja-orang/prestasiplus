import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { GamificationService } from '../../src/modules/gamification'
import { loginAs } from '../auth/helpers'
import { ADMIN, STUDENT_EMPTY, STUDENT_MAJU, START, TEACHER, bootGamificationApp, ledgerOf, userIdOf, walletOf, type GamificationTestApp } from './helpers'

/**
 * SW10-03b / XR-M14-02(a) / FR-M01-69: a student's successful PASSWORD login moves the streak and, on the first login
 * of the Malaysia day, credits +2 `daily_login` ("Streak activity (daily_login)", BR-M14-14, FR-M14-64). Admin and
 * teacher logins add nothing. A failing or hanging hook never fails the login.
 */
describe('M14 login hook (BR-M14-14, FR-M14-64, XR-M14-02a)', () => {
  let t: GamificationTestApp

  beforeAll(async () => {
    t = await bootGamificationApp({ loginHook: true })
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })
  beforeEach(() => {
    t.clock.set(START) // 2026-10-19 09:00 MYT
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const dailyRows = async (userId: string) => (await ledgerOf(t, userId)).filter((r) => r.source === 'daily_login')
  const streakOf = async (userId: string) =>
    (await t.db.query<{ current: number; best: number; last: string | null; total_days: number }>(`select current, best, last_activity_date::text as last, total_days from streaks where user_id = $1`, [userId]))[0]

  it('the first login of the day pays +2 once ("Streak activity (daily_login)", key daily_login:<day>) and starts the streak; a second login the same day adds nothing', async () => {
    const id = await userIdOf(t.db, STUDENT_EMPTY)
    expect(await dailyRows(id)).toEqual([])
    await loginAs(t as never, STUDENT_EMPTY)
    expect(await dailyRows(id)).toEqual([
      expect.objectContaining({ type: 'earn', source: 'daily_login', source_id: 'daily_login:2026-10-19', amount: 2, balance_after: 2, description: 'Streak activity (daily_login)', is_test: false }),
    ])
    expect(await streakOf(id)).toEqual({ current: 1, best: 1, last: '2026-10-19', total_days: 1 })
    t.clock.set('2026-10-19T23:59:30+08:00')
    await loginAs(t as never, STUDENT_EMPTY)
    expect(await dailyRows(id)).toHaveLength(1)
    expect(await walletOf(t, id)).toMatchObject({ current_syiling: 2, total_syiling_earned: 2 })
    expect(await streakOf(id)).toEqual({ current: 1, best: 1, last: '2026-10-19', total_days: 1 })
  })

  it('the next Malaysia day (00:00:30 +08:00) is a new day: +2 again and the streak grows to 2', async () => {
    const id = await userIdOf(t.db, STUDENT_EMPTY)
    t.clock.set('2026-10-20T00:00:30+08:00')
    await loginAs(t as never, STUDENT_EMPTY)
    expect((await dailyRows(id)).map((r) => r.source_id)).toEqual(['daily_login:2026-10-19', 'daily_login:2026-10-20'])
    expect(await walletOf(t, id)).toMatchObject({ current_syiling: 4 })
    expect(await streakOf(id)).toEqual({ current: 2, best: 2, last: '2026-10-20', total_days: 2 })
  })

  it('parallel first logins of one day credit once', async () => {
    const id = await userIdOf(t.db, STUDENT_MAJU)
    const before = (await dailyRows(id)).length
    await Promise.all([1, 2, 3].map(() => loginAs(t as never, STUDENT_MAJU)))
    expect((await dailyRows(id)).length - before).toBe(1)
  })

  it('an admin or a teacher login adds no streak and no daily_login row (students only)', async () => {
    for (const who of [ADMIN, TEACHER]) {
      const id = await userIdOf(t.db, who)
      const rows = (await dailyRows(id)).length
      const streakBefore = await streakOf(id)
      await loginAs(t as never, who)
      expect((await dailyRows(id)).length).toBe(rows)
      expect(await streakOf(id)).toEqual(streakBefore)
    }
  })

  it('a wrong password calls nothing and credits nothing', async () => {
    const id = await userIdOf(t.db, STUDENT_EMPTY)
    t.clock.set('2026-10-21T09:00:00+08:00')
    const hook = vi.spyOn(t.app.get(GamificationService), 'onLogin')
    const res = await t.http().post('/api/auth/login').send({ identifier: STUDENT_EMPTY, password: 'Salah1234', remember: false })
    expect(res.status).toBe(401)
    expect(hook).not.toHaveBeenCalled()
    expect((await dailyRows(id)).map((r) => r.source_id)).not.toContain('daily_login:2026-10-21')
  })

  it('a complimentary pupil (coins off) gets the streak but no syiling row', async () => {
    const id = await userIdOf(t.db, STUDENT_MAJU)
    await t.db.query(`update users set is_complimentary = true where id = $1`, [id])
    try {
      t.clock.set('2026-10-22T09:00:00+08:00')
      const rows = (await dailyRows(id)).length
      await loginAs(t as never, STUDENT_MAJU)
      expect((await dailyRows(id)).length).toBe(rows)
      expect((await streakOf(id))!.last).toBe('2026-10-22')
    } finally {
      await t.db.query(`update users set is_complimentary = false where id = $1`, [id])
    }
  })

  it('the login still succeeds when the hook throws (no session lost, no credit)', async () => {
    const id = await userIdOf(t.db, STUDENT_EMPTY)
    t.clock.set('2026-10-23T09:00:00+08:00')
    vi.spyOn(t.app.get(GamificationService), 'onLogin').mockRejectedValue(new Error('gamification is down'))
    const who = await loginAs(t as never, STUDENT_EMPTY) // asserts 200 and a session cookie
    expect(who.session.user.email).toBe(STUDENT_EMPTY)
    expect((await who.agent.get('/api/session')).status).toBe(200)
    expect((await dailyRows(id)).map((r) => r.source_id)).not.toContain('daily_login:2026-10-23')
  })

  it('a hook that never answers does not hold the login (it answers after the bounded wait)', async () => {
    t.clock.set('2026-10-24T09:00:00+08:00')
    vi.spyOn(t.app.get(GamificationService), 'onLogin').mockImplementation(() => new Promise(() => undefined))
    const started = Date.now()
    await loginAs(t as never, STUDENT_EMPTY)
    expect(Date.now() - started).toBeLessThan(8_000)
  }, 15_000)

  it('the day mark is the idempotency guard: a repeated onLogin the same day writes nothing new', async () => {
    const id = await userIdOf(t.db, STUDENT_EMPTY)
    t.clock.set('2026-10-25T09:00:00+08:00')
    const svc = t.app.get(GamificationService)
    const first = await svc.onLogin(id)
    const again = await svc.onLogin(id)
    expect(first).toMatchObject({ firstToday: true, credited: 2 })
    expect(again).toMatchObject({ firstToday: false, credited: 0 })
    expect((await dailyRows(id)).filter((r) => r.source_id === 'daily_login:2026-10-25')).toHaveLength(1)
  })
})
