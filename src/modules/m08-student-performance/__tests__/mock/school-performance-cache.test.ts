/**
 * S1 `schoolPerformance` memo (perf, additive): the memoised result deep-equals a fresh uncached computation,
 * a data write that changes the owner stamp recomputes, and a warm call on a large school is cheap.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { users } from '@/modules/m01-authentication/mock'
import { questions } from '@/modules/m04-question-bank/mock'
import { practice } from '@/modules/m05-practice/mock'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import { headcountReads, registerHeadcountReads } from '../../mock/repository/headcount-port'
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
  const SCHOOL = 900001
  const scope: Scope = { kind: 'school', schoolId: SCHOOL }
  const firstOf = (role: 'student' | 'teacher', schoolId: number): number => {
    const row = users.adminList({ role, schoolId, pageSize: 1 }).rows[0]
    if (!row) throw new Error(`no ${role} in school ${String(schoolId)}`)
    return row.id
  }

  it('recomputes after a class is created and after an enrolment', () => {
    const now = runtime.clock.now()
    const before = fresh(scope)
    expect(schoolPerformance(scope, YEAR)).toEqual(before)
    classrooms.create(
      {
        name: '4 Cache',
        teacherId: firstOf('teacher', SCHOOL),
        schoolId: SCHOOL,
        subjectId: null,
        educationLevel: 'tingkatan-4',
      },
      now,
    )
    const created = schoolPerformance(scope, YEAR)
    expect(created.header.classCount).toBe(before.header.classCount + 1)
    expect(created).toEqual(fresh(scope))
    const cls = classrooms.list({ kind: 'classroom', schoolId: SCHOOL }).at(-1)
    if (!cls) throw new Error('no class')
    classrooms.enrol(
      { kind: 'classroom', classId: cls.classId, studentId: firstOf('student', SCHOOL), source: 'teacher' },
      now,
    )
    expect(schoolPerformance(scope, YEAR)).toEqual(fresh(scope))
  })

  it('recomputes after an M05 session write and an M05 answer write', () => {
    const studentId = firstOf('student', SCHOOL)
    const before = fresh(scope)
    practice.addSession(studentId, {
      mode: 'random',
      correct: 3,
      total: 5,
      timeSpentSec: 60,
      at: '2026-09-20T10:00:00+08:00',
    })
    const afterSession = schoolPerformance(scope, YEAR)
    expect(afterSession.stats.sessions).toBe(before.stats.sessions + 1)
    expect(afterSession).toEqual(fresh(scope))

    const [questionId] = questions
      .practiceQuery({ subjectId: 3, educationLevelIds: [1], limit: 1, seed: 'cache' })
      .map((q) => q.id)
    if (questionId === undefined) throw new Error('no question')
    schoolPerformance(scope, YEAR)
    practice.addAnswer({ userId: studentId, questionId, isCorrect: true }, runtime.clock.now())
    const afterAnswer = schoolPerformance(scope, YEAR)
    expect(afterAnswer.stats.answered).toBe(afterSession.stats.answered + 1)
    expect(afterAnswer).toEqual(fresh(scope))
  })

  it('recomputes after a headcount write; the output equals a fresh compute', () => {
    const cls = classrooms
      .list({ kind: 'classroom', schoolId: SCHOOL })
      .find((c) => c.subjectId !== null)
    if (!cls || cls.teacherId === null || cls.subjectId === null) throw new Error('no class')
    fresh(scope)
    const key = `${String(SCHOOL)}|${String(YEAR)}`
    const stamp = performanceMemo.get(key)?.stamp
    expect(stamp).toBeDefined()
    headcountRepo.create(
      {
        teacherId: cls.teacherId,
        classroomId: cls.classId,
        subjectId: cls.subjectId,
        educationLevelId: 10,
        academicYear: 2099,
        activeOtrs: 3,
        mode: 'manual',
      },
      runtime.clock.now(),
    )
    const after = schoolPerformance(scope, YEAR)
    expect(performanceMemo.get(key)?.stamp).not.toBe(stamp)
    expect(after).toEqual(fresh(scope))
  })

  it('recomputes after the headcount reader is re-registered', () => {
    const school: Scope = { kind: 'school', schoolId: 8880 }
    const saved = headcountReads.entries()
    try {
      const before = fresh(school)
      expect(before.gps.entries).toBeGreaterThan(0)
      registerHeadcountReads({ entries: () => [] })
      const emptied = schoolPerformance(school, YEAR)
      expect(emptied.gps.entries).toBe(0)
      expect(emptied).toEqual(fresh(school))
    } finally {
      registerHeadcountReads({ entries: () => saved })
    }
    expect(schoolPerformance(school, YEAR).gps.entries).toBeGreaterThan(0)
  })

  it('resetReadCache (run by every seed / reset) empties the memo', () => {
    fresh(scope)
    expect(performanceMemo.size).toBeGreaterThan(0)
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
