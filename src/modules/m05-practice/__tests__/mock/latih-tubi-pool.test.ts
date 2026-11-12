/**
 * C-75: the Latih Tubi quiz draws from the SPM pool (Q-SPM-POOL, BR-M06-02), the same set M06 S4 counts
 * through `questions.spmPool(filter).total`. Never from the wider practice set.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { mulberry32 } from '@/mock/determinism'
import { setUser } from '@/mock/core-data/set-user'
import type { MockRuntime } from '@/mock/index'
import { questions } from '@/modules/m04-question-bank/mock'

import { bootPractice, request } from './helpers'

let runtime: MockRuntime

class MemoryStorage {
  readonly items = new Map<string, string>()
  getItem(key: string) {
    return this.items.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.items.set(key, value)
  }
  removeItem(key: string) {
    this.items.delete(key)
  }
}

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = (await bootPractice()).runtime
}, 120_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

const MATH = 3
const COUNT = 20

async function start(body: Record<string, unknown>) {
  const token = setUser(4).token
  const res = await request(runtime, 'POST', '/api/practice/sessions', token, {
    mode: 'latih_tubi',
    subjectCode: 'MATH',
    ...body,
  })
  const data = (res.body as { data?: { questions: { id: number }[] } }).data
  return { status: res.status, ids: data?.questions.map((q) => q.id) ?? [] }
}

describe('latih_tubi draws the SPM pool (C-75)', () => {
  it('serves min(count, spmPool.total) questions, all of them pool rows', async () => {
    const filter = { subjectId: MATH, educationLevelIds: [11], difficultyLevel: 4 }
    const pool = questions.spmPool(filter)
    expect(pool.total).toBeGreaterThan(0)
    const poolIds = new Set(pool.sample(pool.total, mulberry32(1)).map((q) => q.id))

    const { status, ids } = await start({ levelId: 11, difficulty: 4, count: COUNT })
    expect(status).toBe(201)
    expect(ids).toHaveLength(Math.min(COUNT, pool.total))
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(poolIds.has(id)).toBe(true)
      expect(questions.getEligible(id)).toMatchObject({ subjectId: MATH, spmPool: true })
    }
  })

  it('a spec override of the spmPool facet changes both the count and the draw', async () => {
    const before = questions.spmPool({ subjectId: MATH, educationLevelIds: [11], difficultyLevel: 4 })
    const beforeTotal = before.total
    try {
      await runtime.reset({ questionStore: { spmPool: { MATH: { 11: { 4: 3 } } } } })
      const pool = questions.spmPool({ subjectId: MATH, educationLevelIds: [11], difficultyLevel: 4 })
      expect(pool.total).toBe(3)
      expect(pool.total).not.toBe(beforeTotal)

      const { status, ids } = await start({ levelId: 11, difficulty: 4, count: COUNT })
      expect(status).toBe(201)
      expect(ids).toHaveLength(3)
      for (const id of ids) {
        expect(questions.getEligible(id)).toMatchObject({ subjectId: MATH, spmPool: true })
      }
    } finally {
      await runtime.reset()
    }
  }, 300_000)
})
