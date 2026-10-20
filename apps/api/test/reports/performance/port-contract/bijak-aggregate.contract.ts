import { describe, expect, it } from 'vitest'

import { reduceFacts } from '../../../../src/modules/reports/performance/domain/reduce'
import type { BijakAggregatePort, BijakItemFact, BijakTotals } from '../../../../src/modules/reports/performance/ports'
import type { StoredSitting } from '../fakes/in-memory-bijak-aggregate'
import { item, sitting } from '../fakes/fixtures'

export interface BijakSeed {
  sittings: StoredSitting[]
  items: BijakItemFact[]
}

/** Builds a port holding exactly `seed`. The real adapter's factory inserts the rows into a seeded DB. */
export type BijakFactory = (seed: BijakSeed) => Promise<BijakAggregatePort>

const at = (iso: string) => new Date(iso)
const withoutLast = (t: BijakTotals): Omit<BijakTotals, 'lastSubmittedAt'> => {
  const copy: Partial<BijakTotals> = { ...t }
  delete copy.lastSubmittedAt
  return copy as Omit<BijakTotals, 'lastSubmittedAt'>
}

/**
 * The behaviour every `BijakAggregatePort` must show: the in-memory fake passes it now, the Prisma
 * adapter must pass it after BE-16 merges.
 */
export function describeBijakAggregatePort(name: string, factory: BijakFactory): void {
  describe(`BijakAggregatePort contract: ${name}`, () => {
    const a1 = sitting({ userId: '1', attemptId: 'x1', score: 8, maxScore: 10, durationSeconds: 600, submittedAt: at('2026-09-20T10:10:00+08:00') })
    const a2 = sitting({ userId: '1', attemptId: 'x2', score: 5, maxScore: 10, durationSeconds: 300, submittedAt: at('2026-09-20T23:59:00+08:00'), mode: 'latihan' })
    const a3 = sitting({ userId: '2', attemptId: 'x3', score: 4, maxScore: 10, provisional: true, pendingReview: 2, submittedAt: at('2026-09-21T00:01:00+08:00'), subjectId: '2', subjectCode: 'MT', subjectName: 'Matematik' })
    const b1 = sitting({ userId: '3', attemptId: 'x4', schoolId: 's2', score: 9, maxScore: 10, submittedAt: at('2026-09-22T09:00:00+08:00') })
    const test = sitting({ userId: '1', attemptId: 'x5', score: 10, maxScore: 10 })
    const unfinished = sitting({ userId: '1', attemptId: 'x6' })
    const seed: BijakSeed = {
      sittings: [
        { fact: a1 },
        { fact: a2 },
        { fact: a3 },
        { fact: b1 },
        { fact: test, isTest: true },
        { fact: unfinished, state: 'in_progress' },
      ],
      items: [item({ attemptId: 'x1', userId: '1', questionId: '7' }), item({ attemptId: 'x5', userId: '1', questionId: '7' }), item({ attemptId: 'x6', userId: '1', questionId: '7' })],
    }

    it('never returns test, abandoned or in-progress sittings', async () => {
      const port = await factory(seed)
      const ids = (await port.sittings({})).map((s) => s.attemptId).sort()
      expect(ids).toEqual(['x1', 'x2', 'x3', 'x4'])
    })

    it('filters by user, school, subject, mode and the [from, to) window', async () => {
      const port = await factory(seed)
      expect((await port.sittings({ userIds: ['1'] })).length).toBe(2)
      expect((await port.sittings({ schoolIds: ['s2'] })).map((s) => s.attemptId)).toEqual(['x4'])
      expect((await port.sittings({ subjectId: '2' })).map((s) => s.attemptId)).toEqual(['x3'])
      expect((await port.sittings({ modes: ['latihan'] })).map((s) => s.attemptId)).toEqual(['x2'])
      const win = await port.sittings({ submittedFrom: at('2026-09-20T10:10:00+08:00'), submittedTo: at('2026-09-21T00:01:00+08:00') })
      expect(win.map((s) => s.attemptId).sort()).toEqual(['x1', 'x2'])
    })

    it('totals: one row per key, provisional sittings counted in sittings and seconds but not in the graded base', async () => {
      const port = await factory(seed)
      const rows = await port.totals({}, 'user')
      expect(rows.map((r) => r.userId)).toEqual(['1', '2', '3'])
      const u1 = rows[0]
      expect(u1).toMatchObject({ sittings: 2, score: 13, max: 20, seconds: 900, gradedScore: 13, gradedMax: 20, pupils: 1 })
      const u2 = rows[1]
      expect(u2).toMatchObject({ sittings: 1, score: 4, max: 10, gradedScore: 0, gradedMax: 0 })
    })

    it('totals by day uses the Malaysian calendar day', async () => {
      const port = await factory(seed)
      const rows = await port.totals({ userIds: ['1', '2'] }, 'day')
      expect(rows.map((r) => [r.day, r.sittings])).toEqual([
        ['2026-09-20', 2],
        ['2026-09-21', 1],
      ])
    })

    it('totals equal the reference reduction of the sittings, for every grouping', async () => {
      const port = await factory(seed)
      const facts = await port.sittings({})
      for (const g of ['user', 'user_subject', 'subject', 'school', 'day', 'user_day'] as const) {
        const got = await port.totals({}, g)
        const want = reduceFacts(facts, g)
        expect(got.map(withoutLast)).toEqual(want.map(withoutLast))
      }
    })

    it('subject totals carry the subject name', async () => {
      const port = await factory(seed)
      const rows = await port.totals({}, 'subject')
      expect(rows.map((r) => [r.subjectId, r.subjectName])).toEqual([
        ['1', 'Bahasa Melayu'],
        ['2', 'Matematik'],
      ])
    })

    it('an empty userIds list returns nothing, for sittings, totals and items', async () => {
      const port = await factory(seed)
      expect(await port.sittings({ userIds: [] })).toEqual([])
      expect(await port.totals({ userIds: [] }, 'user')).toEqual([])
      expect(await port.items({ userIds: [] })).toEqual([])
    })

    it('test sittings never count, even when they are the only sittings of a pupil', async () => {
      const port = await factory({ sittings: [{ fact: sitting({ userId: '77', attemptId: 'only-test' }), isTest: true }], items: [] })
      expect(await port.sittings({ userIds: ['77'] })).toEqual([])
      expect(await port.totals({ userIds: ['77'] }, 'user')).toEqual([])
    })

    it('abandoned and in-progress sittings never count', async () => {
      const port = await factory({
        sittings: [
          { fact: sitting({ userId: '78', attemptId: 'ab' }), state: 'abandoned' },
          { fact: sitting({ userId: '78', attemptId: 'ip' }), state: 'in_progress' },
        ],
        items: [],
      })
      expect(await port.sittings({ userIds: ['78'] })).toEqual([])
      expect(await port.totals({}, 'subject')).toEqual(expect.not.arrayContaining([expect.objectContaining({ userId: '78' })]))
    })

    it('provisional sittings add to sittings, score, max and seconds but never to gradedMax', async () => {
      const port = await factory({
        sittings: [
          { fact: sitting({ userId: '79', attemptId: 'p1', score: 3, maxScore: 10, provisional: true, durationSeconds: 40 }) },
          { fact: sitting({ userId: '79', attemptId: 'p2', score: 6, maxScore: 10, durationSeconds: 60 }) },
        ],
        items: [],
      })
      const [row] = await port.totals({ userIds: ['79'] }, 'user')
      expect(row).toMatchObject({ sittings: 2, score: 9, max: 20, seconds: 100, gradedScore: 6, gradedMax: 10 })
    })

    it('items only come from visible sittings', async () => {
      const port = await factory(seed)
      const rows = await port.items({})
      expect(rows.map((r) => r.attemptId)).toEqual(['x1'])
      expect(await port.items({ questionIds: ['99'] })).toEqual([])
    })
  })
}
