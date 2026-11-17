import { Prisma } from '../../src/db/generated/client'
import { describe, expect, it } from 'vitest'

import { QuestionsRepository } from '../../src/modules/questions'

/**
 * `sampleIds` is a two-phase draw: a CHEAP hash-ordered scan (indexed predicates only) proposes ids, and the existing
 * `eligibleAmong` (every learner macro and the shape check, by id) keeps the ones that pass, widening the window until the
 * draw is full or the candidates run out. These specs run the real repository over a fake database that answers both kinds of
 * statement from an in-memory model, so the widening, exhaustion and tiny-subject cases are exact and fast. The SQL-level
 * equivalence with the old single scan is proved on a real database in `sample-two-phase.spec.ts`.
 */

interface Calls {
  hash: { limit: number; text: string }[]
  among: { ids: number; text: string }[]
}

/** `order` is the hash order of the cheap candidates; `passes` is the full eligibility (learner macros + shape). */
function fakeRepo(order: readonly number[], passes: (id: number) => boolean): { repo: QuestionsRepository; calls: Calls } {
  const calls: Calls = { hash: [], among: [] }
  const db = {
    $queryRaw(first: unknown, ...vals: unknown[]) {
      const q: Prisma.Sql = Array.isArray(first) && 'raw' in first ? (Prisma.sql as unknown as (...a: unknown[]) => Prisma.Sql)(first, ...vals) : (first as Prisma.Sql)
      if (q.text.includes('ORDER BY hashtextextended')) {
        const limit = Number(q.values[Number(/LIMIT \$(\d+)/.exec(q.text)?.[1]) - 1])
        calls.hash.push({ limit, text: q.text })
        return Promise.resolve(order.slice(0, limit).map((id) => ({ id: BigInt(id) })))
      }
      const ids = (q.values.find((v) => Array.isArray(v)) as bigint[]).map(Number)
      calls.among.push({ ids: ids.length, text: q.text })
      return Promise.resolve(ids.filter(passes).sort((a, b) => a - b).map((id) => ({ id: BigInt(id) })))
    },
  }
  return { repo: new QuestionsRepository({ client: db } as never), calls }
}

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1)
/** A fixed shuffle, so "hash order" is not the id order. */
const shuffled = (n: number): number[] => range(n).sort((a, b) => ((a * 7919) % 10007) - ((b * 7919) % 10007))
const ids = (xs: readonly number[]): string[] => xs.map(String)

describe('QuestionsRepository.sampleIds two-phase draw (fake database)', () => {
  it('the hash-ordered scan carries none of the expensive learner predicates', async () => {
    const { repo, calls } = fakeRepo(shuffled(50), () => true)
    await repo.sampleIds({ subjectId: '7', type: 'mcq', spmPool: true, wholeGroups: true, mcqShape: { minOptions: 1, maxOptions: 8, allowStimulus: true } }, 10, 99)
    expect(calls.hash).not.toHaveLength(0)
    for (const c of calls.hash) {
      for (const banned of ['question_parts', 'stimuli', 'source_papers', 'answer_keys', 'subject_levels', 'stimulus_group']) expect(c.text, banned).not.toContain(banned)
      expect(c.text).toContain('v.subject_id')
      expect(c.text).toContain('NOT IN (SELECT pt.question_id FROM question_tags') // PKSK stays out of the draw
      expect(c.text).toContain("v.visibility = 'bank'")
    }
    // ... and the by-id verification carries all of them.
    expect(calls.among[0]?.text).toContain('question_parts')
    expect(calls.among[0]?.text).toContain('count(DISTINCT sp.id)')
  })

  it('returns the first n ids of the hash order that pass (a prefix of the full order), whatever the pass rate', async () => {
    const order = shuffled(400)
    const passes = (id: number) => id % 2 === 0
    const { repo } = fakeRepo(order, passes)
    const want = order.filter(passes)
    expect(await repo.sampleIds({ subjectId: '7' }, 10, 1)).toEqual(ids(want.slice(0, 10)))
    expect(await repo.sampleIds({ subjectId: '7' }, 40, 1)).toEqual(ids(want.slice(0, 40)))
  })

  it('low pass rate: widens x4 until the draw is full, verifies each candidate once, in few rounds', async () => {
    const order = shuffled(20_000)
    const passes = (id: number) => id % 33 === 0 // about 3 percent
    const { repo, calls } = fakeRepo(order, passes)
    const want = order.filter(passes)
    expect(await repo.sampleIds({ subjectId: '7', type: 'mcq' }, 10, 5)).toEqual(ids(want.slice(0, 10)))
    expect(calls.hash.length).toBeGreaterThan(1)
    expect(calls.hash.length).toBeLessThanOrEqual(6)
    const limits = calls.hash.map((c) => c.limit)
    expect(limits).toEqual([...limits].sort((a, b) => a - b)) // only ever widens
    expect(calls.among.reduce((n, c) => n + c.ids, 0)).toBeLessThanOrEqual(limits[limits.length - 1] as number) // each id verified once
  })

  it('the same draw comes from a narrow or a wide request (prefix property)', async () => {
    const order = shuffled(3000)
    const passes = (id: number) => id % 5 !== 0
    const { repo } = fakeRepo(order, passes)
    const small = await repo.sampleIds({ subjectId: '7' }, 20, 3)
    const big = await repo.sampleIds({ subjectId: '7' }, 200, 3)
    expect(big.slice(0, 20)).toEqual(small)
  })

  it('tiny subject: fewer eligible rows than n gives them all, in one cheap scan', async () => {
    const { repo, calls } = fakeRepo(shuffled(5), (id) => id <= 3)
    const out = await repo.sampleIds({ subjectId: '7' }, 10, 1)
    expect([...out].sort()).toEqual(['1', '2', '3'])
    expect(calls.hash).toHaveLength(1) // a short window means the cheap set is exhausted: no widening
    expect(await fakeRepo([], () => true).repo.sampleIds({ subjectId: '7' }, 10, 1)).toEqual([])
  })

  it('exhaustion: widening to the end of the cheap set returns what exists and stops', async () => {
    const order = shuffled(2000)
    const only = order[order.length - 1] as number // the single eligible row sits last in hash order
    const { repo, calls } = fakeRepo(order, (id) => id === only)
    expect(await repo.sampleIds({ subjectId: '7' }, 5, 1)).toEqual([String(only)])
    const limits = calls.hash.map((c) => c.limit)
    expect(limits[limits.length - 1]).toBeGreaterThan(2000) // the last window was not full: that is how it knew it was done
    expect(calls.hash.length).toBeLessThanOrEqual(8)
    const none = fakeRepo(order, () => false)
    expect(await none.repo.sampleIds({ subjectId: '7' }, 5, 1)).toEqual([])
  })

  it('stops at the 50,000-row guard when nothing passes', async () => {
    const { repo, calls } = fakeRepo(shuffled(60_000), () => false)
    expect(await repo.sampleIds({ subjectId: '7' }, 5, 1)).toEqual([])
    expect(Math.max(...calls.hash.map((c) => c.limit))).toBe(50_000)
  })

  it('n of 0 or less reads nothing', async () => {
    const { repo, calls } = fakeRepo(shuffled(10), () => true)
    expect(await repo.sampleIds({ subjectId: '7' }, 0, 1)).toEqual([])
    expect(calls.hash).toHaveLength(0)
  })
})
