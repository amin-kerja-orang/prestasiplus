import { describe, expect, it } from 'vitest'
import type { StartSessionRequest } from '@pp/contract'

import { PracticeStartPlanner } from '../../src/modules/practice/start.planner'
import type { PracticePorts, PracticeQuestion } from '../../src/modules/practice/ports'

/**
 * S4-T06: Latih Tubi draws through SPM_SERVABLE_SQL, which serves T4 and T5 only until S4-T06 PR 3 (after S1-T07). So although
 * `offeredLevels` lists T1..T5, a Latih Tubi start at T1..T3 is refused (422 levelId) instead of being accepted and drawing nothing.
 * Fake ports, no database.
 */
const LEVELS = ['T1', 'T2', 'T3', 'T4', 'T5'].map((code, i) => ({ id: String(i + 1), code, order: i + 7, gradeKey: `TINGKATAN_${i + 1}` }))
const now = new Date('2026-10-19T09:00:00+08:00')
const req = (r: Record<string, unknown>) => r as unknown as StartSessionRequest

function planner() {
  const q = { id: 'q1', versionNo: 1, subjectId: '1', educationLevelId: '4', chapterId: null, difficulty: 3, questionType: 'mcq', spmPool: true, questionText: 'q', options: [{ label: 'A', text: 'a' }], correctLabel: 'A' } as unknown as PracticeQuestion
  const sampled: unknown[] = []
  const ports = {
    questions: {
      sample: (s: unknown) => {
        sampled.push(s)
        return Promise.resolve(['q1'])
      },
      live: () => Promise.resolve(new Map([['q1', q]])),
      spmServable: () => Promise.resolve(new Set(['q1'])),
    },
  } as unknown as PracticePorts
  const curriculum = { subjectByCode: () => Promise.resolve({ id: 1n, code: 'ZZ', isActive: true, educationLevelIds: [1n, 2n, 3n, 4n, 5n] }) }
  const repo = { offeredLevels: () => Promise.resolve(LEVELS), countSessions: () => Promise.resolve(0) }
  const subscriptions = { trial: () => Promise.resolve({ active: false, remaining: 1 }) }
  return { p: new PracticeStartPlanner(curriculum as never, ports, repo as never, subscriptions as never), sampled }
}

describe('Latih Tubi levels until the SPM rule serves T1..T3', () => {
  it.each(['1', '2', '3'])('refuses T1..T3 (level id %s) with 422 levelId and draws nothing', async (levelId) => {
    const { p, sampled } = planner()
    await expect(p.plan('u', req({ mode: 'latih_tubi', subjectCode: 'ZZ', count: 5, levelId }), now, false)).rejects.toMatchObject({ fields: { levelId: expect.any(String) } })
    expect(sampled).toHaveLength(0)
  })

  it.each(['4', '5'])('still starts at T4 and T5 (level id %s)', async (levelId) => {
    const { p, sampled } = planner()
    const plan = await p.plan('u', req({ mode: 'latih_tubi', subjectCode: 'ZZ', count: 5, levelId }), now, false)
    expect(plan.served.map((x) => x.id)).toEqual(['q1'])
    expect(sampled).toHaveLength(1)
  })
})
