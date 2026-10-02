/**
 * The real app configuration boots: the discovered core (`src/mock/core-data`) plus every module of
 * `src/mock/registry.ts`, seeded, compiled and live together. This compiles the full D11 datasets
 * (e.g. the 466k-row M04 questions), so it boots **once** with a generous timeout. The fast,
 * seed-free registry checks stay in `seed.test.ts`.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { createClock } from '@/lib/time'

import { bootMock, type MockRuntime } from '../../index'
import { TEST_NOW } from './helpers'

const FULL_BOOT_TIMEOUT_MS = 60_000

describe('full registry boot (core + every registered module)', () => {
  let runtime: MockRuntime
  const warnings: string[] = []
  const errors: unknown[] = []

  beforeAll(async () => {
    runtime = await bootMock({
      mode: 'test',
      clock: createClock({ at: TEST_NOW }),
      latencyMs: 0,
      onWarn: (m) => warnings.push(m),
      onError: (e) => errors.push(e),
    })
  }, FULL_BOOT_TIMEOUT_MS)

  it('loads the real core and all 21 registered modules in registry order', () => {
    expect(runtime.plugins.map((p) => p.id)).toEqual([
      'core',
      'M01',
      'M02',
      'M03',
      'M04',
      'M05',
      'M06',
      'M07',
      'M08',
      'M09',
      'M10',
      'M11',
      'M12',
      'M13',
      'M14',
      'M15',
      'M16',
      'M17',
      'M18',
      'M20',
      'M21',
      'M25',
    ])
    expect(runtime.core.resolveSession).not.toBeNull()
  })

  it('seeds every plugin, compiles every dataset and goes live', () => {
    const steps = runtime.seedSteps
    for (const p of runtime.plugins) {
      expect(steps).toContain(`seed:${p.id}`)
      for (const key of Object.keys(p.datasets)) expect(steps).toContain(`compile:${p.id}.${key}`)
    }
    expect(steps.at(-1)).toBe('baseline')
    expect(runtime.db.phase).toBe('live')
    expect(runtime.seedVersion).toMatch(/^[0-9a-f]{8}$/)
  })

  it('answers requests end to end (guarded core route → 401 for a guest)', async () => {
    const res = await runtime.transport.request({ method: 'GET', url: '/api/me', headers: {} })
    expect(res).toMatchObject({ status: 401, body: { error: { code: 'UNAUTHORIZED' } } })
    expect(errors).toEqual([])
  })
})
