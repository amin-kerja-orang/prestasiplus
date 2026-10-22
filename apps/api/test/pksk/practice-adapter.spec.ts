import { describe, expect, it } from 'vitest'

import { PracticeService } from '../../src/modules/practice/practice.service'
import { PkskPracticeAdapter } from '../../src/modules/pksk/practice.adapter'

/** The real adapter over the real `PracticeService.completePksk`, with a fake repository and reward port (no database). */
describe('PkskPracticeAdapter (BE-12 completePksk)', () => {
  const build = () => {
    const calls: { reward: unknown[]; repo: unknown[] } = { reward: [], repo: [] }
    const repo = {
      completeDirect: async (input: { answers: { isCorrect: boolean }[] }, hook: (d: unknown, tx: unknown) => Promise<unknown>) => {
        calls.repo.push(input)
        const correct = input.answers.filter((a) => a.isCorrect).length
        const done = {
          session: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
          correct,
          total: input.answers.length,
          timeSpentSec: 12,
          coinsEarned: correct,
          pointsEarned: 10 * correct,
          completedAt: new Date('2026-10-21T04:00:00Z'),
        }
        return { done, result: await hook(done, {}) }
      },
    }
    const ports = {
      reward: {
        onSessionCompleted: (input: unknown) => {
          calls.reward.push(input)
          return Promise.resolve({ coinsEarned: 7, streakCount: 3, totalBalance: 107 })
        },
      },
    }
    const service = new PracticeService({} as never, {} as never, repo as never, ports as never, {} as never, {} as never, {} as never)
    return { adapter: new PkskPracticeAdapter(service), calls }
  }

  it('records the scored set and credits through the reward port with the pksk ledger source', async () => {
    const { adapter, calls } = build()
    const res = await adapter.completeDirect({
      userId: '10',
      isTest: true,
      domainCode: 'PKSK_MATH',
      level: 'T1',
      startedAt: new Date('2026-10-21T03:59:00Z'),
      completedAt: new Date('2026-10-21T04:00:00Z'),
      answers: [
        { questionId: '1', isCorrect: true, optionIndex: 0 },
        { questionId: '2', isCorrect: false, optionIndex: null },
      ],
    })
    expect(res).toEqual({ sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', coinsEarned: 7, pointsEarned: 10, streakCount: 3, totalBalance: 107 })
    expect(calls.reward[0]).toMatchObject({ userId: '10', mode: 'pksk', source: 'quiz_pksk', correct: 1, total: 2, sessionCoins: 1, pointsEarned: 10, isTest: true })
  })

  it('a failing reward port propagates, so the surrounding transaction rolls the session back', async () => {
    const { calls } = build()
    const repo = { completeDirect: (_i: unknown, hook: (d: unknown, tx: unknown) => Promise<unknown>) => hook({ session: { id: 's' }, correct: 0, total: 1, timeSpentSec: 0, coinsEarned: 0, pointsEarned: 0, completedAt: new Date() }, {}).then(() => ({ done: {}, result: {} })) }
    const ports = { reward: { onSessionCompleted: () => Promise.reject(new Error('wallet down')) } }
    const adapter = new PkskPracticeAdapter(new PracticeService({} as never, {} as never, repo as never, ports as never, {} as never, {} as never, {} as never))
    await expect(adapter.completeDirect({ userId: '1', isTest: false, domainCode: 'PKSK_MATH', level: 'T4', startedAt: new Date(), completedAt: new Date(), answers: [{ questionId: '1', isCorrect: true, optionIndex: 0 }] })).rejects.toThrow('wallet down')
    expect(calls.reward).toHaveLength(0)
  })
})
