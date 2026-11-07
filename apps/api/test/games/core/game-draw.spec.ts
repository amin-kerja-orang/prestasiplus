import { randomUUID } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { prngStream } from '../../../src/db/prng'
import { difficultyMix, GameQuestions, type GameQuestionFilter } from '../../../src/modules/games/core/game-questions.service'
import type { QuestionRecord, QuestionsRepository } from '../../../src/modules/questions'

type Bank = { id: string; tp: number | null }[]

/** A record `toServed` accepts: one 4-option MCQ. */
const recordOf = ({ id, tp }: Bank[number]): QuestionRecord =>
  ({
    id,
    version: {
      stemMs: `Soalan ${id}`,
      difficultyTp: tp,
      versionNo: 1,
      parts: [
        {
          mode: 'mcq',
          prompt: { ms: '' },
          key: { correct: 'A' },
          options: ['A', 'B', 'C', 'D'].map((label) => ({ label, body: { ms: `Pilihan ${label}` } })),
        },
      ],
    },
  }) as unknown as QuestionRecord

const bankOf = (counts: Record<string, number>): Bank =>
  Object.entries(counts).flatMap(([tp, n]) =>
    Array.from({ length: n }, () => ({ id: String(BigInt('0x' + randomUUID().replaceAll('-', '').slice(0, 12))), tp: tp === 'none' ? null : Number(tp) })),
  )

function service(bank: Bank, recent: string[] = []): GameQuestions {
  const fits = (q: Bank[number], f: GameQuestionFilter): boolean =>
    !(f.excludeIds ?? []).includes(q.id) && (f.difficultyTps === undefined || (q.tp !== null && f.difficultyTps.includes(q.tp)))
  const repo = {
    sample: async (f: GameQuestionFilter, n: number) => bank.filter((q) => fits(q, f)).slice(0, n).map((q) => q.id),
    getMany: async (ids: string[]) => ids.map((id) => recordOf(bank.find((q) => q.id === id) as Bank[number])),
    count: async () => bank.length,
  } as unknown as QuestionsRepository
  const prisma = { client: { practiceAnswer: { findMany: async () => recent.map((id) => ({ questionId: BigInt(id) })) } } }
  return new GameQuestions(repo, prisma as never, { now: () => new Date('2026-11-05T00:00:00Z') } as never)
}

const USER = '7'
const rng = () => prngStream(`test:${randomUUID()}`)
const tally = (bank: Bank, ids: string[]) => {
  const tpOf = (id: string) => bank.find((q) => q.id === id)?.tp ?? null
  const inBand = (tps: number[]) => ids.filter((id) => tps.includes(tpOf(id) as number)).length
  return { low: inBand([1, 2]), mid: inBand([3]), high: inBand([4, 5, 6]) }
}

describe('FR-GM-00.2, 48 section 3.2: the draw', () => {
  it('rule 3: 30% low and 30% high rounded, the remainder in the middle', () => {
    expect(difficultyMix(40)).toEqual({ low: 12, mid: 16, high: 12 })
    expect(difficultyMix(10)).toEqual({ low: 3, mid: 4, high: 3 })
    expect(difficultyMix(8)).toEqual({ low: 2, mid: 4, high: 2 })
    expect(difficultyMix(5)).toEqual({ low: 2, mid: 1, high: 2 })
  })

  it('draws the mix, each question once, shuffled', async () => {
    const bank = bankOf({ 1: 10, 2: 10, 3: 20, 4: 10, 5: 10 })
    const drawn = await service(bank).draw({}, 10, rng(), USER)
    const ids = drawn.map((d) => d.question.id)
    expect(new Set(ids).size).toBe(10)
    expect(tally(bank, ids)).toEqual({ low: 3, mid: 4, high: 3 })
    const order = (await Promise.all([1, 2, 3, 4, 5].map(() => service(bank).draw({}, 10, rng(), USER)))).map((d) => d.map((q) => q.question.id).join())
    expect(new Set(order).size).toBeGreaterThan(1)
  })

  it('a short band fills from the nearest band, then from questions with no difficulty', async () => {
    const noLow = bankOf({ 3: 20, 4: 10 })
    expect(tally(noLow, (await service(noLow).draw({}, 10, rng(), USER)).map((d) => d.question.id))).toEqual({ low: 0, mid: 7, high: 3 })
    const unrated = bankOf({ none: 12 })
    expect(await service(unrated).draw({}, 10, rng(), USER)).toHaveLength(10)
  })

  it('a pool too small gives a short draw, so the caller refuses (rule 6)', async () => {
    expect(await service(bankOf({ 3: 4 })).draw({}, 10, rng(), USER)).toHaveLength(4)
  })

  it('rule 4: skips the pupil\'s last 14 days when the pool holds 3 times the draw', async () => {
    const bank = bankOf({ 3: 30 })
    const recent = bank.slice(0, 5).map((q) => q.id)
    const ids = (await service(bank, recent).draw({}, 10, rng(), USER)).map((d) => d.question.id)
    expect(ids.filter((id) => recent.includes(id))).toEqual([])
  })

  it('rule 4: allows repeats when the pool is under 3 times the draw', async () => {
    const bank = bankOf({ 3: 29 })
    const recent = bank.slice(0, 29).map((q) => q.id)
    expect(await service(bank, recent).draw({}, 10, rng(), USER)).toHaveLength(10)
  })

  it('rule 4: a pool of 3 times the draw that is mostly recent still fills the draw, once each', async () => {
    const bank = bankOf({ 3: 30 })
    const recent = bank.slice(0, 28).map((q) => q.id)
    const ids = (await service(bank, recent).draw({}, 10, rng(), USER)).map((d) => d.question.id)
    expect(ids).toHaveLength(10)
    expect(new Set(ids).size).toBe(10)
  })
})
