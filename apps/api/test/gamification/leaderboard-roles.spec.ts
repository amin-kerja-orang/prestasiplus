import { GamificationAdminOverviewSchema, GamificationLeaderboardSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, STUDENT, TEACHER, bareStudent, bareUser, bootGamificationApp, dataOf, signIn, userIdOf, type GamificationTestApp } from './helpers'

/**
 * FIX-3 / D-08 (LEAD): the pupil board and S1 "Top 10 Pelajar" rank wallets whose owner holds the role `student`.
 * A staff wallet with a higher total never appears; a user with several roles (student + teacher) does; the
 * order stays BR-M14-17 (shown total desc, wallet created asc, id asc).
 */
describe('leaderboard ranks student wallets only (FIX-3 D-08)', () => {
  let t: GamificationTestApp
  let ids: Record<'tieFirst' | 'tieSecond' | 'top' | 'dual' | 'staffOnly' | 'adminWallet', string>

  const credit = (userId: string, amount: number) =>
    t.wallet.credit({ userId, amount, source: 'admin_award', sourceId: `fix3-${userId}`, description: 'Ujian papan', isTest: false })
  const withRole = (userId: string, role: string) => t.db.query(`insert into user_roles (user_id, role) values ($1::bigint, $2) on conflict do nothing`, [userId, role])
  const board = async () => {
    const d = GamificationLeaderboardSchema.parse(dataOf(await (await signIn(t, ADMIN)).get('/gamification/leaderboard')))
    return [...d.podium, ...d.rows]
  }

  beforeAll(async () => {
    t = await bootGamificationApp()
    ids = {
      tieFirst: await bareStudent(t, 'Tie Pertama'),
      tieSecond: await bareStudent(t, 'Tie Kedua'),
      top: await bareStudent(t, 'Teratas'),
      dual: await bareStudent(t, 'Dwi Peranan'),
      staffOnly: await bareUser(t, 'Guru Sahaja'),
      adminWallet: await userIdOf(t.db, ADMIN),
    }
    await withRole(ids.dual, 'teacher')
    await withRole(ids.staffOnly, 'teacher')
    await credit(ids.tieFirst, 60_001) // tie: the older wallet ranks first
    await credit(ids.tieSecond, 60_001)
    await credit(ids.top, 60_050)
    await credit(ids.dual, 60_020)
    await credit(ids.staffOnly, 99_999) // staff, higher than every pupil
    await credit(ids.adminWallet, 88_888)
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('a teacher or admin wallet with a higher total is in neither the podium nor the rows', async () => {
    const rows = await board()
    expect(rows.find((r) => r.userId === ids.staffOnly)).toBeUndefined()
    expect(rows.find((r) => r.userId === ids.adminWallet)).toBeUndefined()
    expect(rows.some((r) => r.totalSyilingEarned >= 88_888)).toBe(false)
    // the pupil viewer sees no staff total either (ids are redacted for him, so check the totals)
    const d = GamificationLeaderboardSchema.parse(dataOf(await (await signIn(t, STUDENT)).get('/gamification/leaderboard')))
    expect([...d.podium, ...d.rows].some((r) => r.totalSyilingEarned >= 88_888)).toBe(false)
  })

  it('a student who also holds another role is ranked', async () => {
    const rows = await board()
    expect(rows.find((r) => r.userId === ids.dual)?.totalSyilingEarned).toBe(60_020)
  })

  it('orders by the shown total, then the older wallet', async () => {
    const rows = await board()
    const order = rows.filter((r) => r.totalSyilingEarned >= 60_000).map((r) => r.userId)
    expect(order).toEqual([ids.top, ids.dual, ids.tieFirst, ids.tieSecond])
    const totals = rows.map((r) => r.totalSyilingEarned)
    expect(totals).toEqual([...totals].sort((a, b) => b - a))
  })

  it('the admin overview Top 10 Pelajar follows the same rule', async () => {
    const d = GamificationAdminOverviewSchema.parse(dataOf(await (await signIn(t, ADMIN)).get('/admin/gamification/overview')))
    expect(d.top10.some((r) => r.totalSyilingEarned >= 88_888)).toBe(false)
    expect(d.top10[0]!.totalSyilingEarned).toBe(60_050)
    expect(d.top10.map((r) => r.rank)).toEqual(d.top10.map((_, i) => i + 1))
  })

  it('the teacher account itself (no student role) is not ranked either', async () => {
    const teacherId = await userIdOf(t.db, TEACHER)
    await credit(teacherId, 77_777)
    expect((await board()).some((r) => r.totalSyilingEarned === 77_777)).toBe(false)
  })
})
