/** The reward bindings of `BijakIntegrationModule` against the real wallet tables. */
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaService } from '../../src/db/prisma.service'
import { BIJAK_REWARD_DESCRIPTION } from '../../src/modules/bijak/attempts/ports'
import { PRACTICE_REWARD_DESCRIPTION, WalletBijakReward, WalletPracticeReward } from '../../src/modules/bijak/integration'
import type { PracticeSessionCompleted } from '../../src/modules/practice/ports'
import { ADMIN, bootIntegrationApp, type IntegrationApp, loginAs, STUDENT } from './helpers'

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

const balance = async (userId: string) => Number((await t.db.query('select current_syiling from wallets where user_id = $1', [userId]))[0]!.current_syiling)
const ledger = (sessionId: string) => t.db.query('select * from coin_ledger where source_id = $1', [sessionId])
const credits = (sessionId: string) => t.db.query('select * from session_credits where session_id = $1', [sessionId])
const streak = async (userId: string) => (await t.db.query('select * from streaks where user_id = $1', [userId]))[0]

const input = (over: Partial<PracticeSessionCompleted> = {}): PracticeSessionCompleted => ({
  userId: studentId,
  sessionId: randomUUID(),
  mode: 'random',
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

  it('6. a throw after the call rolls the ledger row and the session credit back', async () => {
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
  const award = (attemptId: string, coins: number) =>
    bijak.award({ attemptId, userId: studentId, isTest: false, coins, points: coins * 5, score: coins / 2, max: 10, provisional: false, description: BIJAK_REWARD_DESCRIPTION })

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
})
