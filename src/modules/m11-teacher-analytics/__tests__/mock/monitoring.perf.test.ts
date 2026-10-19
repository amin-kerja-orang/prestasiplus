/**
 * Performance budgets of the M11 read models (SRS M11 NFR-M11-01, overview §6.6): the S2 overview never
 * iterates the 472,371 answers per request (facet counts and one grouped pass per school, memoised until
 * the log changes); S3 / S4 / S5 read one school's slice. Budgets are generous (milliseconds, warm
 * caches after the first call); the perf project runs this file alone.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MockRuntime } from '@/mock/index'

import { ADMIN, GURU, MemoryStorage, bootM11, getAs } from './boot'

let runtime: MockRuntime

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = (await bootM11()).runtime
}, 300_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

async function timed(as: number, url: string): Promise<number> {
  const t = performance.now()
  const r = await getAs(runtime, as, url)
  expect(r.status).toBe(200)
  return performance.now() - t
}

describe('M11 budgets', () => {
  it('S2 overview: default and period windows', async () => {
    await timed(ADMIN, '/api/monitoring/overview') // warm the memo
    expect(await timed(ADMIN, '/api/monitoring/overview')).toBeLessThan(250)
    await timed(ADMIN, '/api/monitoring/overview?period=3m')
    expect(await timed(ADMIN, '/api/monitoring/overview?period=3m')).toBeLessThan(250)
    // A cold window computes one grouped pass per school with answers in the window.
    expect(await timed(ADMIN, '/api/monitoring/overview?period=30d')).toBeLessThan(4_000)
  }, 60_000)

  it('S3 of the largest school (549 pupils, 130,233 answers) and a sessionless school', async () => {
    await timed(ADMIN, '/api/monitoring/schools/8082')
    expect(await timed(ADMIN, '/api/monitoring/schools/8082')).toBeLessThan(1_500)
    expect(await timed(ADMIN, '/api/monitoring/schools/8880')).toBeLessThan(5_000)
  }, 60_000)

  it('S4 of a pupil with 265 answers and S5 of a whole school', async () => {
    expect(await timed(ADMIN, '/api/monitoring/schools/8080/students/2010')).toBeLessThan(5_000)
    expect(await timed(ADMIN, '/api/monitoring/schools/8080/teachers/2012')).toBeLessThan(2_000)
  }, 60_000)

  it('S1 and S6 of the teacher with 8 pupils', async () => {
    expect(await timed(GURU, '/api/teacher/report')).toBeLessThan(1_500)
    expect(await timed(GURU, '/api/teacher/item-analysis?classroomId=2001')).toBeLessThan(1_500)
  }, 60_000)
})
