/**
 * XR-M08-M05-01 / -02 budgets (overview §6.6): the bulk reads over a set of users.
 *
 * - `sessionTotals` over every student: one scan of the sessions on cheap fields ≤ 100 ms (the declared
 *   whole-log `match` exception), best of 5;
 * - `answerFacts` / `questionTallies` of class 228 in its subject, cold ≤ 1,500 ms (the first read draws
 *   the questions of the sessions: the eligible pools are read once per subject and level), then cached
 *   ≤ 50 ms.
 *
 * Absolute budgets are only meaningful on a quiet machine: a JS floor loop (about 30 ms quiet) is timed
 * first and the budget assertions are skipped, with a log line, when it is more than 3× slower. Run
 * `npm run test:perf` alone, with no other agent working.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest'

import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { bootMock } from '@/mock/index'
import m01, { users } from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m10, { classrooms } from '@/modules/m10-teacher-class/mock'

import m05, { practice } from '../../mock'

class MemoryStorage {
  readonly items = new Map<string, string>()
  getItem(k: string) {
    return this.items.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.items.set(k, v)
  }
  removeItem(k: string) {
    this.items.delete(k)
  }
}

const now = () => performance.now()
let loaded = false
let students: number[] = []
let members: number[] = []

function floorMs(): number {
  const words = Array.from({ length: 478_499 }, (_, i) => `q${String(i)}`)
  const t0 = now()
  let n = 0
  for (const w of words) if (w.endsWith('9')) n++
  return n >= 0 ? now() - t0 : 0
}

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m10],
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
  students = users.query('U-ROLE', { sort: 'id' }, 'student').rows.map((u) => u.id)
  members = classrooms.memberIds('classroom', 228)
  const floor = Math.min(floorMs(), floorMs(), floorMs())
  loaded = floor > 90
  if (loaded)
    console.warn(
      `M05 aggregates perf: machine too loaded (floor ${floor.toFixed(0)} ms): budgets skipped`,
    )
}, 600_000)

const best = (fn: () => unknown, runs: number): number => {
  let b = Number.POSITIVE_INFINITY
  for (let i = 0; i < runs; i++) {
    const t0 = now()
    fn()
    b = Math.min(b, now() - t0)
  }
  return b
}

describe('M05 bulk reads (XR-M08-M05-01/-02)', () => {
  it('sessionTotals over every student ≤ 100 ms', () => {
    const ms = best(() => practice.sessionTotals(students), 5)
    console.log(`sessionTotals(all students): ${ms.toFixed(1)} ms`)
    if (!loaded) expect(ms).toBeLessThanOrEqual(100)
  })

  it('class 228, subject BI: answerFacts cold ≤ 1,500 ms, cached and questionTallies ≤ 50 ms', () => {
    const t0 = now()
    const facts = practice.answerFacts(members, { subjectId: 2 })
    const cold = now() - t0
    const cached = best(() => practice.answerFacts(members, { subjectId: 2 }), 3)
    const tallies = best(() => practice.questionTallies(members, { subjectId: 2 }), 3)
    console.log(
      `class 228 BI: cold ${cold.toFixed(0)} ms, cached ${cached.toFixed(1)} ms, tallies ${tallies.toFixed(1)} ms`,
    )
    expect(facts.size).toBeGreaterThan(0)
    if (!loaded) {
      expect(cold).toBeLessThanOrEqual(1_500)
      expect(cached).toBeLessThanOrEqual(50)
      expect(tallies).toBeLessThanOrEqual(50)
    }
  })
})
