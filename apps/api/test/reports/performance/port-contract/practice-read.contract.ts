import { describe, expect, it } from 'vitest'

import type { PracticeReadPort } from '../../../../src/modules/reports/performance/ports'

/** What a seed gives the factory. Ids are the seed's own ('1', 's1'); a real-DB factory maps them. */
export interface PracticeSeed {
  pupils: { id: string; name: string; schoolId: string; schoolName: string; state: string; district: string; isActive?: boolean }[]
  sessions: { userId: string; completedAt: Date; questionCount: number; correctCount: number; coins: number; isTest?: boolean }[]
  answers: { userId: string; n: number; correct: number; subjectId?: string; levelCode?: string; isTest?: boolean }[]
}

const SEED: PracticeSeed = {
  pupils: [
    { id: '1', name: 'Aina Binti Hassan', schoolId: 's1', schoolName: 'Sekolah Satu', state: 'Negeri A', district: 'Daerah A' },
    { id: '2', name: 'Bakar Bin Ismail', schoolId: 's1', schoolName: 'Sekolah Satu', state: 'Negeri A', district: 'Daerah A' },
    { id: '3', name: 'Chong Wei Ming', schoolId: 's2', schoolName: 'Sekolah Dua', state: 'Negeri B', district: 'Daerah C' },
    { id: '4', name: 'Devi Nair', schoolId: 's2', schoolName: 'Sekolah Dua', state: 'Negeri B', district: 'Daerah C', isActive: false },
  ],
  sessions: [
    { userId: '1', completedAt: new Date('2026-09-22T10:00:00+08:00'), questionCount: 10, correctCount: 8, coins: 30 },
    { userId: '1', completedAt: new Date('2026-09-22T23:30:00+08:00'), questionCount: 10, correctCount: 6, coins: 20 },
    { userId: '1', completedAt: new Date('2026-09-23T00:30:00+08:00'), questionCount: 10, correctCount: 10, coins: 5, isTest: true },
    { userId: '2', completedAt: new Date('2026-09-24T10:00:00+08:00'), questionCount: 10, correctCount: 10, coins: 50 },
    { userId: '3', completedAt: new Date('2026-09-10T10:00:00+08:00'), questionCount: 10, correctCount: 5, coins: 90 },
    { userId: '4', completedAt: new Date('2026-09-24T10:00:00+08:00'), questionCount: 10, correctCount: 10, coins: 500 },
  ],
  answers: [
    { userId: '1', n: 10, correct: 9 },
    { userId: '1', n: 5, correct: 5, isTest: true },
    { userId: '2', n: 10, correct: 7 },
    { userId: '2', n: 4, correct: 4, subjectId: '2', levelCode: 't5' },
    { userId: '3', n: 2, correct: 2 },
    { userId: '4', n: 20, correct: 20 },
  ],
}

const base = { minAnswers: 3, limit: 100 }

/** The contract every `PracticeReadPort` must meet: the in-memory fake and the SQL adapter run the same cases. */
export function describePracticeReadPort(name: string, make: (seed: PracticeSeed) => Promise<PracticeReadPort>): void {
  describe(`PracticeReadPort: ${name}`, () => {
    it('userTotals: completed non-test sessions of active pupils, grouped by pupil', async () => {
      const port = await make(SEED)
      const t = await port.userTotals({})
      expect(t).toEqual([
        { userId: '1', sessions: 2, questions: 20, correct: 14, coins: 50 },
        { userId: '2', sessions: 1, questions: 10, correct: 10, coins: 50 },
        { userId: '3', sessions: 1, questions: 10, correct: 5, coins: 90 },
      ])
      expect(await port.userTotals({ userIds: ['2'] })).toHaveLength(1)
      expect(await port.userTotals({ userIds: [] })).toEqual([])
      expect(await port.userTotals({ state: 'Negeri B' })).toHaveLength(1)
      expect(await port.userTotals({ from: new Date('2026-09-22T00:00:00+08:00'), to: new Date('2026-09-23T00:00:00+08:00') })).toHaveLength(1)
    })

    it('practiceDays: distinct MYT days, test sessions left out', async () => {
      const port = await make(SEED)
      expect(await port.practiceDays('1')).toEqual(['2026-09-22'])
      expect(await port.practiceDays('2')).toEqual(['2026-09-24'])
      expect(await port.practiceDays('404')).toEqual([])
    })

    it('rankingRows: ranked from minAnswers, test answers and inactive pupils left out, ordered correct DESC then accuracy then id', async () => {
      const port = await make(SEED)
      const r = await port.rankingRows({ ...base })
      expect(r.rows.map((x) => [x.userId, x.correct, x.answered])).toEqual([
        ['2', 11, 14],
        ['1', 9, 10],
      ])
      expect(r.total).toBe(2)
      expect(r.rows[0]).toMatchObject({ name: 'Bakar Bin Ismail', schoolName: 'Sekolah Satu', state: 'Negeri A' })
    })

    it('rankingRows: filters, the row cap, states and scopePupils', async () => {
      const port = await make(SEED)
      expect((await port.rankingRows({ ...base, subjectId: '2' })).rows.map((x) => x.userId)).toEqual(['2'])
      expect((await port.rankingRows({ ...base, levelCode: 't5' })).total).toBe(1)
      const capped = await port.rankingRows({ ...base, limit: 1 })
      expect(capped.rows).toHaveLength(1)
      expect(capped.total).toBe(2)
      const geo = await port.rankingRows({ ...base, state: 'Negeri B' })
      expect(geo.total).toBe(0)
      expect(geo.states).toEqual([{ state: 'Negeri A', pupils: 2 }])
      const dims = await port.rankingRows({ ...base, subjectId: '2' })
      expect(dims.scopePupils).toBe(2)
    })

    it('leaderboard: window, order by coins DESC, me in the full order, test and inactive left out', async () => {
      const port = await make(SEED)
      const to = new Date('2026-09-25T15:40:00+08:00')
      const all = await port.leaderboard({ to, limit: 50, viewerId: '3' })
      expect(all.rows.map((r) => [r.userId, r.coins, r.sessions])).toEqual([
        ['3', 90, 1],
        ['2', 50, 1],
        ['1', 50, 2],
      ])
      expect(all.rows[2]?.accuracy).toBeCloseTo(70, 5)
      expect(all.me).toMatchObject({ userId: '3', rank: 1 })
      const week = await port.leaderboard({ from: new Date('2026-09-21T00:00:00+08:00'), to, limit: 1, viewerId: '1' })
      expect(week.rows).toHaveLength(1)
      expect(week.me).toMatchObject({ userId: '1', rank: 2 })
      expect((await port.leaderboard({ to, limit: 50, viewerId: '4' })).me).toBeNull()
    })
  })
}
