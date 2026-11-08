import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { GamificationService } from '../../src/modules/gamification'
import { loginAs } from '../auth/helpers'
import { ADMIN, STUDENT_EMPTY, START, TEACHER, bootGamificationApp, ledgerOf, signInMod, userIdOf, type GamificationTestApp } from './helpers'

/**
 * S7-T04 part 16b (FR-GM-25.2, "daily login"): the FIRST student password login of the Malaysia day evaluates the badges
 * (savepoint, never fails the login). A second login the same day, a teacher, an admin and Mod Pelajar evaluate nothing.
 */
describe('achievements: the daily-login trigger (S7-T04 part 16b)', () => {
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
    // Every evaluation that came from a login is a real one (is_test exclusion): checked on the spy before it is restored.
    for (const spy of spies) for (const call of spy.mock.calls) expect(call[1]).toMatchObject({ isTest: false })
    spies.length = 0
    vi.restoreAllMocks()
  })
  const spies: { mock: { calls: unknown[][] } }[] = []
  const watch = () => {
    const spy = vi.spyOn(GamificationService.prototype, 'evaluateAchievementsSafely')
    spies.push(spy as never)
    return spy
  }

  const badgeRows = async (id: string) => (await ledgerOf(t, id)).filter((r) => r.source === 'achievement')
  const unlocks = (id: string) => t.db.query<{ name: string }>(`select a.name from user_achievements ua join achievements a on a.id = ua.achievement_id where ua.user_id = $1`, [id])

  it('a first login that moves the streak to 3 unlocks "Streak 3 Hari" once and credits once; a second login the same day does not evaluate and pays nothing', async () => {
    const id = await userIdOf(t.db, STUDENT_EMPTY)
    await t.db.query(`delete from streaks where user_id = $1`, [id])
    await t.db.query(`insert into streaks (user_id, current, best, last_activity_date, total_days) values ($1, 2, 2, '2026-10-18', 2)`, [id])
    const spy = watch()
    await loginAs(t as never, STUDENT_EMPTY)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]![1]).toMatchObject({ isTest: false, kinds: ['streak'] })
    expect((await unlocks(id)).map((r) => r.name)).toContain('Streak 3 Hari')
    const rows = (await badgeRows(id)).filter((r) => r.description === 'Pencapaian: Streak 3 Hari')
    expect(rows).toHaveLength(1)
    const total = (await badgeRows(id)).length
    t.clock.set('2026-10-19T23:00:00+08:00')
    await loginAs(t as never, STUDENT_EMPTY)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(await badgeRows(id)).toHaveLength(total)
  })

  it('a login evaluates only the streak badges: a pupil who already qualifies for the syiling-total badge does not unlock it or get paid for it', async () => {
    const id = await userIdOf(t.db, STUDENT_EMPTY)
    t.clock.set('2026-11-03T09:00:00+08:00')
    await t.wallet.credit({ userId: id, amount: 500, isTest: false, source: 'admin_award', sourceId: 'login-badges-500', description: 'Anugerah' })
    const before = (await t.db.query<{ current_syiling: number }>(`select current_syiling from wallets where user_id = $1`, [id]))[0]!.current_syiling
    await loginAs(t as never, STUDENT_EMPTY)
    expect((await unlocks(id)).map((r) => r.name)).not.toContain('Pengumpul Syiling')
    expect((await badgeRows(id)).filter((r) => r.description === 'Pencapaian: Pengumpul Syiling')).toHaveLength(0)
    expect((await t.db.query<{ current_syiling: number }>(`select current_syiling from wallets where user_id = $1`, [id]))[0]!.current_syiling).toBe(before + 2) // only the daily +2
  })

  it('a teacher login evaluates nothing', async () => {
    const spy = watch()
    await loginAs(t as never, TEACHER)
    expect(spy).not.toHaveBeenCalled()
  })

  it('an admin login, and entering Mod Pelajar afterwards, evaluate nothing', async () => {
    const spy = watch()
    await signInMod(t, ADMIN)
    expect(spy).not.toHaveBeenCalled()
  })

  it('a pupil who logs in and then asks for Mod Pelajar (admin-only, refused): the login evaluated once as a real one, nothing more', async () => {
    t.clock.set('2026-10-25T09:00:00+08:00')
    const spy = watch()
    const who = await loginAs(t as never, STUDENT_EMPTY)
    expect(spy).toHaveBeenCalledTimes(1)
    const res = await who.agent.post('/api/session/mode').set('X-CSRF-Token', who.csrf).send({ mode: 'mod_pelajar' })
    expect(res.status).toBe(403)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]![1]).toMatchObject({ isTest: false })
  })

  it('an evaluation error does not fail the login or the daily credit', async () => {
    const id = await userIdOf(t.db, STUDENT_EMPTY)
    t.clock.set('2026-10-22T09:00:00+08:00')
    watch()
    const spy = vi.spyOn(GamificationService.prototype, 'evaluateAchievements').mockRejectedValue(new Error('boom'))
    await loginAs(t as never, STUDENT_EMPTY) // asserts the login succeeds
    expect(spy).toHaveBeenCalled()
    expect((await ledgerOf(t, id)).filter((r) => r.source_id === 'daily_login:2026-10-22')).toHaveLength(1)
  })
})
