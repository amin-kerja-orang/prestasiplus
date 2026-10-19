/**
 * Perf cases of the headcount read models on a large roster (overview §6.6 perf policy; M08-T1b review):
 * #24 summary (S22) and #25 detail (S23) of a config on class 228 (93 members, 90 with an entry).
 * Budget gates only: cold and repeated calls within 1,500 ms, skipped (and logged) when the paired JS
 * floor runs more than 3x slower than quiet; never widened.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import { headcount } from '../../mock'
import { MemoryStorage, bootM08 } from './boot'
import { ADMIN, call } from './headcount-helpers'

const BUDGET_MS = 1500
const QUIET_FLOOR_MS = 30

let runtime: MockRuntime
let tooLoaded = false
let skipped = 0
let gates = 0
let configId = 0

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
  const r = await call(runtime, ADMIN, 'GET', url)
  expect(r.status).toBe(200)
  return performance.now() - t
}

function gate(label: string, ms: number): void {
  gates++
  if (tooLoaded) {
    skipped++
    console.warn(`perf gate skipped (machine too loaded): ${label} ${String(Math.round(ms))} ms`)
    return
  }
  expect(ms, label).toBeLessThanOrEqual(BUDGET_MS)
}

beforeAll(async () => {
  tooLoaded = measureFloor() > QUIET_FLOOR_MS * 3
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = (await bootM08()).runtime
  const cls = classrooms.get('classroom', 228)
  if (!cls || cls.teacherId === null) throw new Error('class 228 is missing')
  const members = classrooms.memberIds('classroom', 228)
  expect(members.length).toBeGreaterThanOrEqual(90)
  const config = headcount.create(
    {
      teacherId: cls.teacherId,
      classroomId: 228,
      subjectId: 2,
      educationLevelId: 11,
      academicYear: 2026,
      activeOtrs: 5,
      mode: 'auto',
    },
    runtime.clock.now(),
  )
  configId = config.id
  // 90 empty entries (drop, then restore) on top of the 3 members without one.
  const ninety = members.slice(0, 90)
  headcount.setDropped(configId, ninety, true, runtime.clock.now())
  headcount.setDropped(configId, ninety, false, runtime.clock.now())
}, 180_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('headcount read models on a 90-member roster', () => {
  const cases: [string, () => string][] = [
    ['#24 summary', () => `/api/headcounts/${String(configId)}/summary`],
    ['#25 detail (ranking)', () => `/api/headcounts/${String(configId)}`],
    ['#25 detail (name)', () => `/api/headcounts/${String(configId)}?sort=name`],
  ]
  for (const [label, url] of cases) {
    it(`${label}: cold and repeated within ${String(BUDGET_MS)} ms`, async () => {
      const cold = await timed(url())
      console.log(`${label}: cold ${String(Math.round(cold))} ms`)
      gate(`${label} cold`, cold)
      const again = await timed(url())
      console.log(`${label}: repeat ${String(Math.round(again))} ms`)
      gate(`${label} repeat`, again)
    }, 120_000)
  }

  it('the roster is the 93 members; the summary and detail agree', async () => {
    const r = await call<{ data: { students: number } }>(
      runtime,
      ADMIN,
      'GET',
      `/api/headcounts/${String(configId)}/summary`,
    )
    const detail = await call<{ data: { rows: unknown[] } }>(
      runtime,
      ADMIN,
      'GET',
      `/api/headcounts/${String(configId)}`,
    )
    expect(r.body.data.students).toBe(detail.body.data.rows.length)
    expect(r.body.data.students).toBeGreaterThanOrEqual(90)
  })

  it('assertSkipShare: at most 25 % of the budget gates were skipped', () => {
    expect(skipped / Math.max(1, gates)).toBeLessThanOrEqual(0.25)
  })
})
