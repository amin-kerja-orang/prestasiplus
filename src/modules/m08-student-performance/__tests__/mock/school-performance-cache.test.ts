/**
 * S1 `schoolPerformance` memo (perf, additive): the memoised result deep-equals a fresh uncached computation,
 * a data write that changes the owner stamp recomputes, and a warm call on a large school is cheap.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import { headcountRepo } from '../../mock/repository/headcount'
import { schoolPerformance, type Scope } from '../../mock/repository/performance'
import { performanceMemo, resetReadCache } from '../../mock/repository/reads'
import { MemoryStorage, bootM08 } from './boot'

const YEAR = 2026
const SCHOOLS = [8078, 8082, 8880, 900003] as const
let runtime: MockRuntime

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = (await bootM08()).runtime
}, 180_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

const fresh = (scope: Scope, year = YEAR) => {
  resetReadCache()
  return schoolPerformance(scope, year)
}

describe('schoolPerformance memo: equality with the uncached computation', () => {
  const scopes: Scope[] = [
    { kind: 'platform' },
    ...SCHOOLS.map((schoolId) => ({ kind: 'school' as const, schoolId })),
  ]
  for (const scope of scopes) {
    it(`${scope.kind === 'platform' ? 'platform' : String(scope.schoolId)}: cached equals fresh`, () => {
      const uncached = fresh(scope)
      const first = schoolPerformance(scope, YEAR)
      const second = schoolPerformance(scope, YEAR)
      expect(first).toEqual(uncached)
      expect(second).toEqual(uncached)
      expect(second).not.toBe(first) // callers get their own copy
    }, 120_000)
  }

  it('keys on the clock year', () => {
    const scope: Scope = { kind: 'school', schoolId: 900003 }
    const a = fresh(scope, YEAR)
    const b = schoolPerformance(scope, YEAR + 1)
    expect(b).toEqual(fresh(scope, YEAR + 1))
    expect(schoolPerformance(scope, YEAR)).toEqual(a)
  })

  it('a caller mutating its copy does not poison the memo', () => {
    const scope: Scope = { kind: 'school', schoolId: 900003 }
    const a = fresh(scope)
    a.header.classCount = -1
    expect(schoolPerformance(scope, YEAR).header.classCount).not.toBe(-1)
  })
})

describe('schoolPerformance memo: invalidation', () => {
  it('recomputes after a class is created and after an enrolment', () => {
    const scope: Scope = { kind: 'school', schoolId: 900001 }
    const now = runtime.clock.now()
    const before = fresh(scope)
    expect(schoolPerformance(scope, YEAR)).toEqual(before)
    classrooms.create(
      {
        name: '4 Cache',
        teacherId: 5,
        schoolId: 900001,
        subjectId: null,
        educationLevel: 'tingkatan-4',
      },
      now,
    )
    const created = schoolPerformance(scope, YEAR)
    expect(created.header.classCount).toBe(before.header.classCount + 1)
    expect(created).toEqual(fresh(scope))
    const enrolled = classrooms.list({ kind: 'classroom', schoolId: 900001 }).at(-1)
    expect(enrolled).toBeDefined()
    classrooms.enrol(
      { kind: 'classroom', classId: enrolled?.classId ?? 0, studentId: 2, source: 'teacher' },
      now,
    )
    expect(schoolPerformance(scope, YEAR)).toEqual(fresh(scope))
  })

  it('recomputes after a headcount write (revision) and after a seed reset clears the memo', () => {
    const scope: Scope = { kind: 'school', schoolId: 900003 }
    fresh(scope)
    const entry = performanceMemo.get(`900003|${String(YEAR)}`)
    expect(entry).toBeDefined()
    headcountRepo.create(
      {
        teacherId: 5,
        classroomId: 516,
        subjectId: 3,
        educationLevelId: 10,
        academicYear: 2099,
        activeOtrs: 3,
        mode: 'manual',
      },
      runtime.clock.now(),
    )
    schoolPerformance(scope, YEAR)
    expect(performanceMemo.get(`900003|${String(YEAR)}`)?.stamp).not.toBe(entry?.stamp)
    resetReadCache()
    expect(performanceMemo.size).toBe(0)
  })
})

describe('|perf| schoolPerformance 8078', () => {
  it('logs the cold time; the warm call stays under 100 ms', () => {
    const scope: Scope = { kind: 'school', schoolId: 8078 }
    resetReadCache()
    const t0 = performance.now()
    const cold = schoolPerformance(scope, YEAR)
    const coldMs = performance.now() - t0
    let warmMs = Infinity
    for (let i = 0; i < 3; i++) {
      const t = performance.now()
      const warm = schoolPerformance(scope, YEAR)
      warmMs = Math.min(warmMs, performance.now() - t)
      expect(warm).toEqual(cold)
    }
    console.info(
      `[perf] schoolPerformance 8078: cold ${coldMs.toFixed(0)} ms, warm ${warmMs.toFixed(1)} ms`,
    )
    expect(warmMs).toBeLessThan(100)
  }, 180_000)
})
