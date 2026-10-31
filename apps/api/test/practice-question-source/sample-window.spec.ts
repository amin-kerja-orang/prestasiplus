import { Logger } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { mulberry32, prngStream } from '../../src/db/prng'
import { Be09PracticeQuestionSource } from '../../src/modules/practice/question-bridge'
import { OVER_FETCH } from '../../src/modules/practice/question-bridge/be09-practice-question-source'
import { QuestionsRepository, type QuestionRecord } from '../../src/modules/questions'
import type { QuestionFilter } from '../../src/modules/questions/types'
import { UsersRepository } from '../../src/modules/users'

/**
 * BE-12 follow-up (#92 G4 nits 1 and 2), no database: `sample` over-fetches a bounded window (`n * 4`) and
 * widens it only when the draw comes up short, and hydrates each window or chapter in one `getMany` round
 * trip (per 500 ids). `sample` is the REAL BE-09 `QuestionsRepository.sample` (seed from the stream); only `sampleIds`
 * (the SQL draw, faked as a seeded order), `eligibleIds` and `getMany` are faked.
 */

const now = new Date('2026-10-21T00:00:00Z')

/** A live published version; `servable: false` makes it a type practice refuses (not a text MCQ). */
function record(id: string, servable: boolean): QuestionRecord {
  return {
    id,
    isActive: true,
    sourceType: null,
    createdById: null,
    latestVersionNo: 1,
    liveVersionNo: 1,
    groupId: null,
    groupPosition: null,
    spmPool: false,
    createdAt: now,
    updatedAt: now,
    version: {
      id,
      versionNo: 1,
      status: 'approved',
      archiveReason: null,
      publishedAt: now,
      type: (servable ? 'mcq' : 'subjective') as never,
      stemMs: 'Soalan',
      stemEn: null,
      numberLabel: null,
      language: 'ms' as never,
      explanationMs: null,
      explanationEn: null,
      subjectId: '1',
      educationLevelId: '2',
      unitId: null,
      chapterId: '4',
      topicId: null,
      formOrigin: null,
      cognitiveLevel: null,
      difficultyTp: 3,
      sourcePage: null,
      setLabel: null,
      sourceFile: null,
      spIds: [],
      stimulusIds: [],
      parts: [
        {
          label: '1',
          mode: 'mcq',
          marks: 1,
          prompt: { ms: 'Pilih jawapan.' },
          options: ['A', 'B', 'C', 'D'].map((label) => ({ label, body: { ms: `Pilihan ${label}` } })),
          key: { kind: 'option', correct: 'A' },
        },
      ] as never,
      createdAt: now,
      updatedAt: now,
    },
  } as unknown as QuestionRecord
}

interface Bank {
  source: Be09PracticeQuestionSource
  /** `limit` of every `QuestionsRepository.sample` call. */
  sampleLimits: number[]
  /** Size of every `getMany` call. */
  getManySizes: number[]
}

/** `total` eligible ids '1'..`total`; `servable(i)` decides which ones practice can serve. */
function bank(total: number, servable: (i: number) => boolean): Bank {
  const ids = Array.from({ length: total }, (_, i) => String(i + 1))
  const sampleLimits: number[] = []
  const getManySizes: number[] = []
  const repo = Object.create(QuestionsRepository.prototype) as QuestionsRepository
  const realSample = QuestionsRepository.prototype.sample
  Object.assign(repo, {
    // Stands in for the SQL `ORDER BY hashtextextended(id, seed), id LIMIT n`: a fixed order per seed, cut to `n`.
    sampleIds: async (_f: QuestionFilter, n: number, seed: number) =>
      [...ids]
        .map((id) => ({ id, key: mulberry32((seed + Number(id) * 2654435761) >>> 0).next() }))
        .sort((a, b) => a.key - b.key || Number(a.id) - Number(b.id))
        .slice(0, n)
        .map((x) => x.id),
    eligibleIds: async () => [...ids],
    eligibleIdsPage: async (_f: QuestionFilter, after: string | undefined, limit: number) =>
      ids.filter((id) => after === undefined || Number(id) > Number(after)).slice(0, limit),
    sample: async function (this: QuestionsRepository, f: QuestionFilter, n: number, rng: Parameters<QuestionsRepository['sample']>[2]) {
      sampleLimits.push(n)
      return realSample.call(this, f, n, rng)
    },
    getMany: async (want: readonly string[]) => {
      getManySizes.push(want.length)
      return want.map((id) => record(id, servable(Number(id))))
    },
  })
  const users = { getMany: async () => [] } as unknown as UsersRepository
  return { source: new Be09PracticeQuestionSource(repo, users), sampleLimits, getManySizes }
}

/** The whole eligible list in the order a window draws it (same child seed as `sample` derives). */
async function fullOrder(total: number, seedName: string): Promise<string[]> {
  const seed = prngStream(seedName).int(0, 0xffffffff)
  const b = bank(total, () => true)
  const repo = (b.source as unknown as { questions: QuestionsRepository }).questions
  return repo.sample({}, Number.MAX_SAFE_INTEGER, mulberry32(seed))
}

const SEL = { subjectId: '1' }

// The fakes refuse many ids on purpose; keep the once-per-version refusal warnings out of the test output.
beforeAll(() => Logger.overrideLogger(false))
afterAll(() => Logger.overrideLogger(new Logger()))

describe('sample: bounded over-fetch (#92 nit 1)', () => {
  it('asks the bank for n * 4 ids, not the whole list, and hydrates that window in one round trip', async () => {
    const b = bank(1000, () => true)
    const ids = await b.source.sample(SEL, 10, prngStream('w1'))
    expect(ids).toHaveLength(10)
    expect(b.sampleLimits).toEqual([10 * OVER_FETCH])
    expect(b.getManySizes).toEqual([10 * OVER_FETCH])
    // The draw is the first 10 of the full shuffle: bounding the window does not change which ids are drawn.
    expect(ids).toEqual((await fullOrder(1000, 'w1')).slice(0, 10))
  })

  it('widens the window when too few in it are servable, and the draw is still the full-order prefix', async () => {
    // Only every 10th id is servable: a window of 40 holds about 4, so it must widen (40 -> 160 -> ...).
    const servable = (i: number): boolean => i % 10 === 0
    const b = bank(1000, servable)
    const ids = await b.source.sample(SEL, 10, prngStream('w2'))
    expect(ids).toHaveLength(10)
    expect(b.sampleLimits.length).toBeGreaterThan(1)
    expect(b.sampleLimits[0]).toBe(40)
    for (let i = 1; i < b.sampleLimits.length; i++) expect(b.sampleLimits[i]).toBe((b.sampleLimits[i - 1] as number) * OVER_FETCH)
    // Each widened window hydrates only the ids not already checked.
    expect(b.getManySizes.reduce((a, x) => a + x, 0)).toBe(Math.min(1000, b.sampleLimits.at(-1) as number))
    expect(ids).toEqual((await fullOrder(1000, 'w2')).filter((id) => servable(Number(id))).slice(0, 10))
    expect(new Set(ids).size).toBe(10)
  })

  it('same seed, same draw; another seed, another draw', async () => {
    const a = await bank(500, (i) => i % 3 === 0).source.sample(SEL, 20, prngStream('same'))
    const b = await bank(500, (i) => i % 3 === 0).source.sample(SEL, 20, prngStream('same'))
    const c = await bank(500, (i) => i % 3 === 0).source.sample(SEL, 20, prngStream('other'))
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
  })

  it('a bank too small for the draw returns what it has after one window (the planner then answers 422)', async () => {
    const b = bank(7, () => true)
    expect((await b.source.sample(SEL, 10, prngStream('w3'))).sort()).toEqual(['1', '2', '3', '4', '5', '6', '7'])
    expect(b.sampleLimits).toEqual([40])
    expect(b.getManySizes).toEqual([7])
  })

  it('a bank with too few servable ids stops once the window covers it, with every servable id', async () => {
    const b = bank(300, (i) => i <= 3)
    const ids = await b.source.sample(SEL, 10, prngStream('w4'))
    expect(ids.sort()).toEqual(['1', '2', '3'])
    // 40 -> 160 -> 640 (>= 300, so the bank is exhausted): three windows, then stop.
    expect(b.sampleLimits).toEqual([40, 160, 640])
    expect(b.getManySizes.reduce((a, x) => a + x, 0)).toBe(300)
  })
})

describe('hydrate round trips are batched (#92 nit 2)', () => {
  it('chapterQuestionIds hydrates 500 ids per getMany call', async () => {
    const b = bank(1200, (i) => i % 2 === 0)
    const ids = await b.source.chapterQuestionIds('4')
    expect(b.getManySizes).toEqual([500, 500, 200])
    expect(ids).toHaveLength(600)
    expect(ids[0]).toBe('2')
  })

  it('a small chapter is a single round trip', async () => {
    const b = bank(120, () => true)
    expect(await b.source.chapterQuestionIds('4')).toHaveLength(120)
    expect(b.getManySizes).toEqual([120])
  })
})
