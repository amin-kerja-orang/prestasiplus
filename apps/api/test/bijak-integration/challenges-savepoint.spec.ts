import type { StartSessionResponse } from '@pp/contract'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { gamificationSeed } from '../../prisma/seed/gamification'
import { GamificationService } from '../../src/modules/gamification'
import { PracticePorts } from '../../src/modules/practice/ports'
import { fillBank, FakeBank, loadWorld, type World } from '../practice/helpers'
import { bootIntegrationApp, type Client, type IntegrationApp, loginAs } from './helpers'

/**
 * `WalletPracticeReward.onSessionCompleted` settles the daily challenges (BR-M14-13) in a SAVEPOINT (`challenges_settle`) of the
 * submit transaction, like the achievements: a challenge is a bonus, so its failure skips only the challenge progress and rewards
 * of that call. The session, the answers and the session credit stay committed and the submit answers 200.
 */
let t: IntegrationApp
let w: World
let bank: FakeBank
let maju: Client
let student: Client

beforeAll(async () => {
  t = await bootIntegrationApp({ extraSeeds: [gamificationSeed] })
  w = await loadWorld(t.db)
  bank = new FakeBank()
  fillBank(bank, w, { perChapter: 6, random: 30, spm: 4 })
  t.app.get(PracticePorts).provideQuestions(bank)
  maju = await loginAs(t, 'pelajarmaju@demo.test')
  student = await loginAs(t, 'pelajar@demo.test')
}, 120_000)
afterAll(async () => {
  await t.close()
})
afterEach(() => {
  vi.restoreAllMocks()
})

/** Starts a MATH D1 `random` session, answers every question wrongly (so only the `sessions` metric moves) and submits. */
async function play(who: Client): Promise<string> {
  const start = await who.post('/api/practice/sessions', { mode: 'random', subjectCode: 'MATH', levelId: w.level.d1, count: 5 })
  expect(start.status, JSON.stringify(start.body)).toBe(201)
  const data = start.body.data as StartSessionResponse
  for (const q of data.questions) {
    const wrong = (bank.correctIndex(q.id) + 1) % bank.get(q.id).options.length
    expect((await who.post(`/api/practice/sessions/${data.sessionId}/check-answer`, { questionId: q.id, selectedOptionId: wrong })).status).toBe(200)
  }
  const done = await who.post(`/api/practice/sessions/${data.sessionId}/submit`, { timeSpent: 60 })
  expect(done.status, JSON.stringify(done.body)).toBe(200) // a challenge failure must not fail the submit
  return data.sessionId
}
const completionCount = async (userId: string) => (await t.db.query(`select 1 from challenge_completions where user_id = $1`, [userId])).length
const challengeLedger = async (userId: string) => (await t.db.query(`select 1 from coin_ledger where user_id = $1 and source = 'daily_challenge'`, [userId])).length

/** The submit stayed committed: completed session, its answers and its credit. */
async function expectSubmitCommitted(sessionId: string): Promise<void> {
  expect((await t.db.query<{ status: string }>(`select status from practice_sessions where id = $1`, [sessionId]))[0]?.status).toBe('completed')
  expect((await t.db.query(`select 1 from session_credits where session_id = $1`, [sessionId])).length).toBe(1)
  expect((await t.db.query(`select 1 from practice_answers where session_id = $1`, [sessionId])).length).toBeGreaterThan(0)
}

describe('a challenge settlement failure cannot fail the practice submit (BR-M14-13, savepoint challenges_settle)', () => {
  it('1. settleChallenges writes (a completion and a ledger row) and then throws: the submit is 200, the session and the credit stay, the partial challenge rows are gone', async () => {
    const gamification = t.app.get(GamificationService)
    const mula = (await t.db.query<{ id: string }>(`select id::text from challenges where title = 'Mula Hari Ini'`))[0]!.id
    const completionsBefore = await completionCount(maju.userId)
    const ledgerBefore = await challengeLedger(maju.userId)
    vi.spyOn(gamification, 'settleChallenges').mockImplementation(async (userId, opts) => {
      const r = await gamification.claimChallenge(userId, mula, opts) // a partial write inside the submit transaction
      expect(r.claimed).toBe(true)
      throw new Error('settle boom')
    })
    const sessionId = await play(maju)
    await expectSubmitCommitted(sessionId)
    expect(await completionCount(maju.userId)).toBe(completionsBefore) // rolled back to the savepoint
    expect(await challengeLedger(maju.userId)).toBe(ledgerBefore)
  })

  it('2. a real database error (SELECT 1/0) after a write: the aborted transaction is recovered by the savepoint, same result', async () => {
    const gamification = t.app.get(GamificationService)
    const mula = (await t.db.query<{ id: string }>(`select id::text from challenges where title = 'Mula Hari Ini'`))[0]!.id
    const completionsBefore = await completionCount(student.userId)
    const ledgerBefore = await challengeLedger(student.userId)
    vi.spyOn(gamification, 'settleChallenges').mockImplementation(async (userId, opts) => {
      await gamification.claimChallenge(userId, mula, opts)
      await opts.tx!.$queryRaw`SELECT 1/0` // division_by_zero: the transaction is now in the aborted state
      return { claimedIds: [], syiling: 0, xp: 0 }
    })
    const sessionId = await play(student)
    await expectSubmitCommitted(sessionId)
    expect(await completionCount(student.userId)).toBe(completionsBefore)
    expect(await challengeLedger(student.userId)).toBe(ledgerBefore)
  })

  it('3. the next session settles normally: the skipped challenge is claimed then', async () => {
    vi.restoreAllMocks()
    await play(maju)
    expect(await completionCount(maju.userId)).toBeGreaterThanOrEqual(1)
    expect(await challengeLedger(maju.userId)).toBeGreaterThanOrEqual(1)
  })
})
