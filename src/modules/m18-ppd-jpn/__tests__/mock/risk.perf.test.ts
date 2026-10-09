/**
 * Perf budget of the M18 risk read model (overview §6.6): after the warm-up call, `risk.forSchool` of
 * the largest seeded school answers well under 100 ms (a memo lookup per data stamp, as M08 does).
 */

import { beforeAll, describe, expect, it, vi } from 'vitest'

import { CLOCK_ANCHOR_MS } from '@/lib/time'

import { risk } from '../../mock'
import { MemoryStorage, bootM18 } from './boot'

const now = CLOCK_ANCHOR_MS

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  await bootM18()
}, 600_000)

describe('risk performance', () => {
  it('warm forSchool of a large school (8082) and of 8880 answers in under 100 ms', () => {
    for (const id of [8082, 8880]) {
      const warm = risk.forSchool(id, { now }) // warm-up: the cold computation
      expect(warm.total).toBeGreaterThan(50)
      const t = performance.now()
      for (let i = 0; i < 20; i++) risk.forSchool(id, { now })
      expect((performance.now() - t) / 20).toBeLessThan(100)
    }
  }, 600_000)

  it('the tingkatan filter and the list are also served from the memo', () => {
    risk.pupilsForSchool(8082, { now })
    const t = performance.now()
    for (let i = 0; i < 20; i++) risk.forSchool(8082, { now, tingkatan: 4 })
    expect((performance.now() - t) / 20).toBeLessThan(100)
  }, 600_000)
})
