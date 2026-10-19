/**
 * Perf cases of the M08 read models over the owners' bulk reads (overview §6.6 perf policy; M08 review
 * Major 1): S1 platform, S3 Tingkatan 5, S9 school 8880 (computed path, school 900001) and class 228;
 * M08-T7: S5 class 228 (93 members, subject class), class 516 (no subject, bulk totals) and S8 class 4.
 * Budget gates only: every call (cold and repeated) within 1,500 ms. A gate is skipped, and logged, when
 * the paired JS floor measured before the cases runs more than 3x slower than quiet; never widened.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MockRuntime } from '@/mock/index'

import { ADMIN, MemoryStorage, bootM08, getAs } from './boot'

const BUDGET_MS = 1500 // a response that derives rows (overview §6.6 budget 2)
const QUIET_FLOOR_MS = 30 // a JS loop over ~478k strings on a quiet machine

let runtime: MockRuntime
let tooLoaded = false
let skipped = 0
let gates = 0

/** Best of three runs of the paired JS floor (taken once, before the cases). */
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
  const r = await getAs(runtime, ADMIN, url)
  expect(r.status).toBe(200)
  return performance.now() - t
}

function gate(label: string, ms: number, budget = BUDGET_MS): void {
  gates++
  if (tooLoaded) {
    skipped++
    console.warn(`perf gate skipped (machine too loaded): ${label} ${String(Math.round(ms))} ms`)
    return
  }
  expect(ms, label).toBeLessThanOrEqual(budget)
}

beforeAll(async () => {
  const floor = measureFloor()
  tooLoaded = floor > QUIET_FLOOR_MS * 3
  console.log(`paired JS floor ${String(Math.round(floor))} ms (loaded: ${String(tooLoaded)})`)
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = (await bootM08()).runtime
}, 180_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('M08 read models on the bulk reads', () => {
  // [label, url, repeat budget]: S1 and S3 are not memoised (no clean cross-module write stamp), so a repeat equals the cold cost; only S11 class 228 is memoised (≤ 50 ms).
  const cases: [string, string, number][] = [
    ['S1 platform', '/api/performance/school', BUDGET_MS],
    ['S3 Tingkatan 5', '/api/performance/levels/t5', BUDGET_MS],
    ['S9 school 8880 T4', '/api/item-analysis/school/8880?tingkatan=T4', BUDGET_MS],
    ['S9 school 900001 (computed subject table)', '/api/item-analysis/school/900001', BUDGET_MS],
    ['S11 class 228', '/api/item-analysis/classes/228', 50],
    // M08-T7: S5 is memoised per class, minute and member set; S8 reads stored profiles only.
    ['S5 class 228 (subject class, 93 members)', '/api/performance/classes/228', 50],
    ['S5 class 516 (no subject, bulk totals)', '/api/performance/classes/516', 50],
    ['S8 class 4', '/api/analytics/classes?classroomId=4&subjectId=1', 50],
  ]
  for (const [label, url, repeatBudget] of cases) {
    it(`${label}: cold and repeated within ${String(BUDGET_MS)} ms`, async () => {
      const cold = await timed(url)
      console.log(`${label}: cold ${String(Math.round(cold))} ms`)
      gate(`${label} cold`, cold)
      const again = await timed(url)
      console.log(`${label}: repeat ${String(Math.round(again))} ms`)
      gate(`${label} repeat`, again, repeatBudget)
    }, 120_000)
  }

  it('assertSkipShare: at most 25 % of the budget gates were skipped', () => {
    expect(skipped / Math.max(1, gates)).toBeLessThanOrEqual(0.25)
  })
})
