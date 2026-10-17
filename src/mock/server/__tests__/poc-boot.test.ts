/**
 * The PoC data profile (D45, `VITE_DATA_PROFILE=poc`): the real registry boots with every virtual
 * dataset scaled down, and the demo accounts and anchor records are still there.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { createClock } from '@/lib/time'

import { bootMock, type MockRuntime } from '../../index'
import { TEST_NOW } from './helpers'

interface Queryable {
  query(q?: object): { rows: unknown[]; total: number }
}

const BOOT_TIMEOUT_MS = Number(process.env.BOOT_TEST_TIMEOUT_MS) || 120_000

describe('PoC data profile boot', () => {
  let runtime: MockRuntime
  let bootMs = 0
  const errors: unknown[] = []

  beforeAll(async () => {
    vi.stubEnv('VITE_DATA_PROFILE', 'poc')
    const t0 = performance.now()
    runtime = await bootMock({
      mode: 'test',
      clock: createClock({ at: TEST_NOW }),
      latencyMs: 0,
      onError: (e) => errors.push(e),
    })
    bootMs = performance.now() - t0
  }, BOOT_TIMEOUT_MS)

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  it('boots without errors', () => {
    expect(errors).toEqual([])
    console.log(`poc boot: ${String(Math.round(bootMs))} ms`)
  })

  it('keeps every demo account and shrinks the big datasets', () => {
    const users = runtime.db.store('users') as unknown as Queryable | undefined
    expect(users).toBeDefined()
    const emails = [
      'admin@demo.test',
      'pelajar@demo.test',
      'pelajarmaju@demo.test',
      'pelajar2@demo.test',
      'guru@demo.test',
      'adminsekolah@demo.test',
    ]
    const rows = users!.query({ limit: 100_000 }).rows as { email?: string }[]
    for (const email of emails) expect(rows.some((r) => r.email === email)).toBe(true)
    expect(rows.length).toBeGreaterThan(0)
    const answers = runtime.db.store('practice.answers') as unknown as Queryable | undefined
    expect(answers).toBeDefined()
    expect(answers!.query({ limit: 1 }).total).toBeLessThan(50_000)
  })
})
