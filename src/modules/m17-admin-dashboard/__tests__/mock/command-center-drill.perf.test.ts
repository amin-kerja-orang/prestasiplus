/**
 * Perf cases of the Command Center drill-down (overview §6.6 perf policy; M17-T1a): S4 of the largest
 * school (8082: 549 pupils, 68 teachers, 55 classes), S5 of a seven-class teacher, S6 of a 30-pupil
 * class and S7 of one pupil. Budget gates only: each repeated call within 1,500 ms and the cold S4,
 * which builds M05's whole-log answer index once for the runtime, within 15,000 ms; a gate is skipped
 * (and logged) when the paired JS floor runs more than 3x slower than quiet; never widened.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import type { MockRuntime } from '@/mock/index'

import { ADMIN, bootDrill, call } from './drill-helpers'

const WARM_BUDGET_MS = 1500
const COLD_BUDGET_MS = 15_000
const QUIET_FLOOR_MS = 30

let runtime: MockRuntime
let tooLoaded = false

function measureFloor(): number {
  const data = Array.from({ length: 478_499 }, (_, i) => String(i))
  let best = Infinity
  for (let r = 0; r < 3; r++) {
    const t = performance.now()
    let n = 0
    for (const s of data) if (s.length > 5) n++
    best = Math.min(best, performance.now() - t + n * 0)
  }
  return best
}

async function timed(url: string): Promise<number> {
  const t = performance.now()
  const r = await call(runtime, ADMIN, url)
  expect(r.status, url).toBe(200)
  return performance.now() - t
}

function gate(label: string, ms: number, budget: number): void {
  if (tooLoaded) {
    console.warn(`perf gate skipped (machine too loaded): ${label} ${String(Math.round(ms))} ms`)
    return
  }
  expect(ms, label).toBeLessThanOrEqual(budget)
}

beforeAll(async () => {
  tooLoaded = measureFloor() > QUIET_FLOOR_MS * 3
  runtime = (await bootDrill()).runtime
}, 600_000)

describe('drill-down request budgets', () => {
  it('S4 of school 8082: cold within 15 s, repeated within 1.5 s', async () => {
    const url = '/api/command-center/school/8082'
    gate('S4 8082 cold', await timed(url), COLD_BUDGET_MS)
    gate('S4 8082 repeated', await timed(url), WARM_BUDGET_MS)
  }, 120_000)

  it('S5 of teacher 1919 (7 classes, 164 pupils) within 1.5 s', async () => {
    gate('S5 1919', await timed('/api/command-center/school/8080/teacher/1919'), WARM_BUDGET_MS)
  })

  it('S6 of class 370 (30 pupils, latest answer placed per pupil) within 1.5 s', async () => {
    await timed('/api/command-center/classroom/370')
    gate('S6 370', await timed('/api/command-center/classroom/370'), WARM_BUDGET_MS)
  })

  it('S7 of pupil 2022 and its all-sessions modal within 1.5 s', async () => {
    gate('S7 2022', await timed('/api/command-center/student/2022'), WARM_BUDGET_MS)
    gate(
      'S7 all sessions',
      await timed('/api/command-center/student/2022/week?start=2020-01-01&end=2030-12-31'),
      WARM_BUDGET_MS,
    )
  })
})
