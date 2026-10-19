/**
 * M05-T1 dashboard budget (G4 follow-up): `GET /api/dashboard` assembles about 25 named-query
 * counts, 5 grouped difficulty aggregates and the viewer's week. Wall-clock ceilings, generous
 * against a quiet machine (the measured values are printed on every run) and meant to catch a
 * regression such as a count per subject × difficulty, not to measure a few milliseconds.
 *
 * - cold (first call after boot, caches empty): ≤ 1,500 ms
 * - warm (best of 5 following calls): ≤ 400 ms
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MockRuntime } from '@/mock/index'

import { MAJU, MemoryStorage, PELAJAR, bootAll, getAs } from './boot-all'

const COLD_MS = 1_500
const WARM_MS = 400

let runtime: MockRuntime

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = (await bootAll()).runtime
}, 120_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

async function timed(userId: number): Promise<number> {
  const t = performance.now()
  const r = await getAs(runtime, userId, '/api/dashboard')
  const ms = performance.now() - t
  expect(r.status).toBe(200)
  return ms
}

describe('GET /api/dashboard budget', () => {
  it(`cold ≤ ${String(COLD_MS)} ms, warm ≤ ${String(WARM_MS)} ms`, async () => {
    const cold = await timed(PELAJAR)
    const warm: number[] = []
    for (let i = 0; i < 5; i++) warm.push(await timed(i % 2 === 0 ? MAJU : PELAJAR))
    const best = Math.min(...warm)
    process.stdout.write(
      `dashboard cold ${cold.toFixed(0)} ms, warm best ${best.toFixed(0)} ms (${warm.map((w) => w.toFixed(0)).join(', ')})\n`,
    )
    expect(cold).toBeLessThanOrEqual(COLD_MS)
    expect(best).toBeLessThanOrEqual(WARM_MS)
  })
})
