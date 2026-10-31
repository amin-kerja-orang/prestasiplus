/** The reward bindings of `BijakIntegrationModule` against the real wallet tables. */
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaService } from '../../src/db/prisma.service'
import { BIJAK_REWARD_DESCRIPTION } from '../../src/modules/bijak/attempts/ports'
import { PRACTICE_REWARD_DESCRIPTION, WalletBijakReward, WalletPracticeReward } from '../../src/modules/bijak/integration'
import { practiceRewardSource, type PracticeSessionCompleted } from '../../src/modules/practice/ports'
import { ADMIN, bootIntegrationApp, type IntegrationApp, loginAs, START, STUDENT } from './helpers'

let t: IntegrationApp
let studentId: string
let adminId: string
let practice: WalletPracticeReward
let bijak: WalletBijakReward
let prisma: PrismaService

beforeAll(async () => {
  t = await bootIntegrationApp()
  studentId = (await loginAs(t, STUDENT)).userId
  adminId = (await loginAs(t, ADMIN)).userId
  practice = t.app.get(WalletPracticeReward)
  bijak = t.app.get(WalletBijakReward)
  prisma = t.app.get(PrismaService)
})
afterAll(async () => {
  await t.close()
})

const balance = async (userId: string) => Number((await t.db.query('select current_syiling from wallets where user_id = $1', [userId]))[0]?.current_syiling ?? 0)
const ledger = (sessionId: string) => t.db.query('select * from coin_ledger where source_id = $1', [sessionId])
const credits = (sessionId: string) => t.db.query('select * from session_credits where session_id = $1', [sessionId])
const streak = async (userId: string) => (await t.db.query('select * from streaks where user_id = $1', [userId]))[0]

const input = (over: Partial<PracticeSessionCompleted> = {}): PracticeSessionCompleted => ({
  userId: studentId,
  sessionId: randomUUID(),
  mode: 'random',
  source: 'quiz_practice',
  correct: 5,
  total: 10,
  timeSpent: 120,
  completedAt: new Date('2026-10-20T01:00:00Z'),
  pointsEarned: 50,
  sessionCoins: 5,
  isTest: false,
  ...over,
})
const run = (i: PracticeSessionCompleted) => prisma.transaction((tx) => practice.onSessionCompleted(i, tx))

describe('WalletPracticeReward.onSessionCompleted', () => {
  it('1. credits the session coins, stores the session credit and touches the streak', async () => {
    const i = input()
    const before = await balance(studentId)
    const out = await run(i)
    expect(out.coinsEarned).toBe(5)
    expect(out.totalBalance).toBe(before + 5)
    const rows = await ledger(i.sessionId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ source: 'quiz_practice', source_id: i.sessionId, description: PRACTICE_REWARD_DESCRIPTION, is_test: false, amount: 5, user_id: studentId })
    const sc = await credits(i.sessionId)
    expect(sc).toHaveLength(1)
    expect(sc[0]).toMatchObject({ coins_earned: 5, points_earned: 50, total_balance: before + 5, is_test: false })
    expect((await streak(studentId))!.current).toBeGreaterThanOrEqual(1)
    expect(await balance(studentId)).toBe(before + 5)
  })

  it('2. a replay returns the same result and writes nothing more', async () => {
    const i = input()
    const first = await run(i)
    const balanceAfter = await balance(studentId)
    const again = await run(i)
    expect(again).toEqual(first)
    expect(await ledger(i.sessionId)).toHaveLength(1)
    expect(await credits(i.sessionId)).toHaveLength(1)
    expect(await balance(studentId)).toBe(balanceAfter)
  })

  it('3. zero coins write no ledger row but record the session credit with the current balance', async () => {
    const i = input({ sessionCoins: 0, pointsEarned: 0 })
    const before = await balance(studentId)
    const out = await run(i)
    expect(out.coinsEarned).toBe(0)
    expect(out.totalBalance).toBe(before)
    expect(await ledger(i.sessionId)).toHaveLength(0)
    const sc = await credits(i.sessionId)
    expect(sc).toHaveLength(1)
    expect(sc[0]).toMatchObject({ coins_earned: 0, total_balance: before })
    expect(await balance(studentId)).toBe(before)
  })

  it('4. NaN coins and points count as 0 and do not throw', async () => {
    const i = input({ sessionCoins: Number.NaN, pointsEarned: Number.NaN })
    const before = await balance(studentId)
    const out = await run(i)
    expect(out.coinsEarned).toBe(0)
    expect(out.totalBalance).toBe(before)
    expect(await ledger(i.sessionId)).toHaveLength(0)
    expect((await credits(i.sessionId))[0]).toMatchObject({ coins_earned: 0, points_earned: 0 })
  })

  it('5. a test session is flagged is_test everywhere and leaves the admin streak untouched', async () => {
    const i = input({ userId: adminId, isTest: true })
    const streakBefore = await streak(adminId)
    const out = await run(i)
    expect(out.coinsEarned).toBe(5)
    expect((await ledger(i.sessionId))[0]).toMatchObject({ source: 'quiz_practice', is_test: true, user_id: adminId })
    expect((await credits(i.sessionId))[0]).toMatchObject({ is_test: true, user_id: adminId })
    expect(await streak(adminId)).toEqual(streakBefore)
  })

  it('6. the ledger source follows the mode (practiceRewardSource, M14 BR-M14-03)', async () => {
    for (const [mode, source] of [
      ['latih_tubi', 'quiz_spm'],
      ['pksk', 'quiz_pksk'],
      ['chapter', 'quiz_practice'],
    ] as const) {
      expect(practiceRewardSource(mode)).toBe(source)
      const i = input({ mode, source })
      await run(i)
      const rows = await ledger(i.sessionId)
      expect(rows, mode).toHaveLength(1)
      expect(rows[0]).toMatchObject({ source, source_id: i.sessionId, amount: 5 })
    }
  })

  it('7. a throw after the call rolls the ledger row and the session credit back', async () => {
    const i = input()
    const before = await balance(studentId)
    await expect(
      prisma.transaction(async (tx) => {
        await practice.onSessionCompleted(i, tx)
        throw new Error('rollback')
      }),
    ).rejects.toThrow('rollback')
    expect(await ledger(i.sessionId)).toHaveLength(0)
    expect(await credits(i.sessionId)).toHaveLength(0)
    expect(await balance(studentId)).toBe(before)
  })
})

describe('WalletBijakReward.award', () => {
  const award = (attemptId: string, coins: number, over: { userId?: string; isTest?: boolean } = {}) =>
    bijak.award({ attemptId, userId: over.userId ?? studentId, isTest: over.isTest ?? false, coins, points: coins * 5, score: coins / 2, max: 10, provisional: false, description: BIJAK_REWARD_DESCRIPTION })

  it('credits once per attempt, refuses the same attempt with another amount, and ignores zero coins', async () => {
    const attemptId = randomUUID()
    const before = await balance(studentId)
    await award(attemptId, 4)
    await award(attemptId, 4)
    const rows = await t.db.query('select * from coin_ledger where source = $1 and source_id = $2', ['quiz_spm', attemptId])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ amount: 4, is_test: false })
    expect(await balance(studentId)).toBe(before + 4)

    await expect(award(attemptId, 6)).rejects.toThrow()
    expect(await ledger(attemptId)).toHaveLength(1)
    expect(await balance(studentId)).toBe(before + 4)

    const zero = randomUUID()
    await award(zero, 0)
    expect(await ledger(zero)).toHaveLength(0)
    expect(await balance(studentId)).toBe(before + 4)
  })

  it('floors a fractional amount (half marks) and credits nothing when it floors to 0', async () => {
    const half = randomUUID()
    const before = await balance(studentId)
    await award(half, 3.5)
    expect((await ledger(half))[0]).toMatchObject({ amount: 3, source: 'quiz_spm' })
    const tiny = randomUUID()
    await award(tiny, 0.5)
    await award(randomUUID(), -2)
    expect(await ledger(tiny)).toHaveLength(0)
    expect(await balance(studentId)).toBe(before + 3)
  })

  const xpOf = async (userId: string) => Number((await t.db.query('select xp from wallets where user_id = $1', [userId]))[0]?.xp ?? 0)

  it('adds the XP (10 per mark) once with the syiling: a replay pays neither the ledger row nor the XP again', async () => {
    const attemptId = randomUUID()
    const xpBefore = await xpOf(studentId)
    await award(attemptId, 4) // score 2 marks: 4 syiling, 20 XP
    expect(await xpOf(studentId)).toBe(xpBefore + 20)
    await award(attemptId, 4)
    await award(attemptId, 4)
    expect(await xpOf(studentId)).toBe(xpBefore + 20)
    expect(await t.db.query('select 1 from coin_ledger where source = $1 and source_id = $2', ['quiz_spm', attemptId])).toHaveLength(1)
    // a refused second amount rolls everything back: no XP either
    await expect(award(attemptId, 6)).rejects.toThrow()
    expect(await xpOf(studentId)).toBe(xpBefore + 20)
  })

  it('touches the streak (kombo) on the day the attempt closed: last day, total days and current move once per day, even for a zero score', async () => {
    const pupil = (await loginAs(t, 'pelajar2@demo.test')).userId
    const state = async () =>
      (
        await t.db.query<{ current: number; last: string | null; total_days: number }>(
          `select current, to_char(last_activity_date, 'YYYY-MM-DD') last, total_days from streaks where user_id = $1`,
          [pupil],
        )
      )[0] ?? { current: 0, last: null, total_days: 0 }
    const sit = (coins: number, closed: string) =>
      bijak.award({ attemptId: randomUUID(), userId: pupil, isTest: false, coins, points: coins * 5, submittedAt: new Date(closed), score: coins / 2, max: 10, provisional: false, description: BIJAK_REWARD_DESCRIPTION })
    // the login of 2026-10-20 already touched the streak: day 1
    const day1 = await state()
    expect(day1).toMatchObject({ last: '2026-10-20', total_days: 1 })
    expect(day1.current).toBeGreaterThanOrEqual(1)
    // the same day, a zero score then a scoring sitting: nothing moves (once per day)
    await sit(0, '2026-10-20T00:20:00Z')
    await sit(2, '2026-10-20T00:40:00Z')
    expect(await state()).toEqual(day1)
    // the next day: one more day, the streak continues (a zero score counts too)
    t.clock.set('2026-10-21T09:00:00+08:00')
    try {
      await sit(0, '2026-10-21T00:20:00Z')
      const day2 = await state()
      expect(day2).toEqual({ current: day1.current + 1, last: '2026-10-21', total_days: 2 })
      await sit(2, '2026-10-21T00:40:00Z')
      expect(await state()).toEqual(day2)
      // a late event on an earlier day never moves the streak backwards
      await sit(2, '2026-10-19T02:00:00Z')
      expect(await state()).toEqual(day2)
    } finally {
      t.clock.set(START)
    }
  })

  it('AC-20.3: a Mod Pelajar attempt moves no XP and no streak either', async () => {
    const streakBefore = await streak(adminId)
    const xpBefore = await xpOf(adminId)
    await award(randomUUID(), 8, { userId: adminId, isTest: true })
    expect(await xpOf(adminId)).toBe(xpBefore)
    expect(await streak(adminId)).toEqual(streakBefore)
  })

  it('AC-20.3: a Mod Pelajar (is_test) attempt writes no ledger row and moves no balance', async () => {
    const attemptId = randomUUID()
    const before = await balance(adminId)
    await award(attemptId, 8, { userId: adminId, isTest: true })
    expect(await ledger(attemptId)).toHaveLength(0)
    expect(await balance(adminId)).toBe(before)
  })
})
