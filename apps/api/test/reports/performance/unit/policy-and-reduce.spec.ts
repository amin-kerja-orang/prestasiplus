import { ROLE_CODES } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import {
  ITEM_SCHOOL_ROLES,
  canOpenClassAnalysis,
  canOpenClassDashboard,
  mayOpenStudent,
  officerCoverage,
  schoolAccess,
  viewerSchoolId,
} from '../../../../src/modules/reports/performance/domain/access-policy'
import { MIN_COHORT } from '../../../../src/modules/reports/performance/domain/constants'
import { canSeeName, isStaff, meetsCohort, nameFor } from '../../../../src/modules/reports/performance/domain/privacy'
import { figuresOf, reduceFacts } from '../../../../src/modules/reports/performance/domain/reduce'
import type { ClassInfo } from '../../../../src/modules/reports/performance/ports'
import { InMemoryBijakAggregate } from '../fakes/in-memory-bijak-aggregate'
import { ctxOf, sitting } from '../fakes/fixtures'

const cls = (over: Partial<ClassInfo> = {}): ClassInfo => ({
  id: '10', kind: 'classroom', name: 'K', schoolId: 's1', teacherId: 't1', teacherName: null, subjectId: null, subjectName: null,
  color: null, levelSlug: 't4', year: 2026, joinCode: 'X', isActive: true, createdAt: new Date(), studentCount: 0, ...over,
})

describe('class access matrix', () => {
  it.each([
    ['admin', 'a', true, true],
    ['teacher', 't1', true, true],
    ['teacher', 't2', false, false],
    ['school_admin', 'sa1', true, false],
    ['student', '1', false, false],
    ['ppd_officer', 'o', false, false],
    ['parent', 'p', false, false],
    ['sponsor', 'p', false, false],
  ] as const)('%s %s: dashboard %s, analysis %s', (role, id, dashboard, analysis) => {
    const ctx = ctxOf(role, id)
    expect(canOpenClassDashboard(ctx, cls())).toBe(dashboard)
    expect(canOpenClassAnalysis(ctx, cls())).toBe(analysis)
  })
  it('school classes open for nobody, other schools only for the admin', () => {
    expect(canOpenClassDashboard(ctxOf('admin', 'a'), cls({ kind: 'school_class' }))).toBe(false)
    expect(canOpenClassDashboard(ctxOf('school_admin', 'sa1'), cls({ schoolId: 's2' }))).toBe(false)
    expect(canOpenClassDashboard(ctxOf('admin', 'a'), cls({ schoolId: 's2' }))).toBe(true)
  })
})

describe('student access', () => {
  const pupil = { id: '1', schoolId: 's1' }
  const none = { teaches: false }
  it('self, admin, teaching teacher, own-school admin, officer in scope', () => {
    expect(mayOpenStudent(ctxOf('student', '1'), pupil, none)).toBe(true)
    expect(mayOpenStudent(ctxOf('admin', 'a'), pupil, none)).toBe(true)
    expect(mayOpenStudent(ctxOf('teacher', 't'), pupil, { ...none, teaches: true })).toBe(true)
    expect(mayOpenStudent(ctxOf('teacher', 't'), pupil, none)).toBe(false)
    expect(mayOpenStudent(ctxOf('school_admin', 'sa'), pupil, none)).toBe(true)
    expect(mayOpenStudent(ctxOf('school_admin', 'sa', { level: 'school', schoolId: 's2', label: 'x' }), pupil, none)).toBe(false)
    expect(mayOpenStudent(ctxOf('ppd_officer', 'o'), pupil, none)).toBe(false)
  })
})

describe('school access', () => {
  it('only the five roles; non-admins reach own school or officer coverage', () => {
    expect(ITEM_SCHOOL_ROLES).toEqual(['admin', 'teacher', 'school_admin', 'student', 'ppd_officer'])
    const none = new Set<string>()
    for (const role of ROLE_CODES) {
      const ok = ITEM_SCHOOL_ROLES.includes(role)
      expect(schoolAccess(ctxOf(role, 'u', { level: 'school', schoolId: 's1', label: 'x' }), 's1', new Set(['s1'])) === 'ok').toBe(ok)
    }
    expect(schoolAccess(ctxOf('admin', 'a'), 'zzz', none)).toBe('ok')
    expect(schoolAccess(ctxOf('teacher', 't'), 's2', none)).toBe('forbidden')
    expect(schoolAccess(ctxOf('ppd_officer', 'o'), 's2', new Set(['s2']))).toBe('ok')
  })
  it('scope helpers', () => {
    expect(viewerSchoolId(ctxOf('teacher', 't'))).toBe('s1')
    expect(viewerSchoolId(ctxOf('admin', 'a', { level: 'national', label: 'x' }))).toBeNull()
    expect(officerCoverage({ scope: { level: 'district', stateCode: 'S', districtCode: 'D', label: 'x' } })).toEqual({ state: 'S', district: 'D' })
    expect(officerCoverage({ scope: { level: 'district', districtCode: 'D', label: 'x' } })).toBeNull()
    expect(officerCoverage({ scope: { level: 'state', stateCode: 'S', label: 'x' } })).toEqual({ state: 'S' })
    expect(officerCoverage({ scope: { level: 'school', schoolId: '1', label: 'x' } })).toBeNull()
  })
})

describe('privacy rules', () => {
  it('minimum cohort is 5 and binds only non-staff', () => {
    expect(MIN_COHORT).toBe(5)
    expect(meetsCohort('student', 4)).toBe(false)
    expect(meetsCohort('student', 5)).toBe(true)
    expect(meetsCohort('ppd_officer', 0)).toBe(false)
    expect(meetsCohort('teacher', 1)).toBe(true)
    expect(meetsCohort('school_admin', 0)).toBe(true)
    expect(isStaff('parent')).toBe(false)
  })
  it('names: admin, school admin, self, and a teacher for own pupils only', () => {
    const own = new Set(['1'])
    expect(canSeeName('admin', 'a', '1', own)).toBe(true)
    expect(canSeeName('school_admin', 'sa', '1', own)).toBe(true)
    expect(canSeeName('student', '2', '2', own)).toBe(true)
    expect(canSeeName('student', '2', '1', own)).toBe(false)
    expect(canSeeName('teacher', 't', '1', own)).toBe(true)
    expect(canSeeName('teacher', 't', '3', own)).toBe(false)
    expect(canSeeName('ppd_officer', 'o', '1', own)).toBe(false)
    expect(nameFor('Aina', false)).toBe('Murid')
    expect(nameFor('Aina', true)).toBe('Aina')
  })
})

describe('reduceFacts', () => {
  const facts = [
    sitting({ userId: '1', score: 8, maxScore: 10, durationSeconds: 100 }),
    sitting({ userId: '1', score: 2, maxScore: 10, durationSeconds: 50, provisional: true }),
    sitting({ userId: '2', score: 5, maxScore: 5, durationSeconds: 25 }),
  ]
  it('matches hand sums; provisional sittings count everywhere but the graded base', () => {
    expect(figuresOf(facts)).toEqual({ sittings: 3, score: 15, max: 25, answered: 12, seconds: 175, gradedScore: 13, gradedMax: 15 })
    const rows = reduceFacts(facts, 'user')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ userId: '1', sittings: 2, score: 10, max: 20, seconds: 150, gradedScore: 8, gradedMax: 10, pupils: 1 })
  })
  it('answered sums the answered questions, not the marks (issue 61 m1)', () => {
    const f = [
      sitting({ userId: '1', score: 8, maxScore: 10, answeredCount: 3 }),
      sitting({ userId: '1', score: 2, maxScore: 10, answeredCount: 0, provisional: true }),
      sitting({ userId: '2', score: 5, maxScore: 5, answeredCount: 2 }),
    ]
    expect(figuresOf(f)).toMatchObject({ max: 25, answered: 5 })
    expect(reduceFacts(f, 'user').map((r) => [r.userId, r.max, r.answered])).toEqual([
      ['1', 20, 3],
      ['2', 5, 2],
    ])
    expect(reduceFacts(f, 'school')[0]).toMatchObject({ max: 25, answered: 5 })
  })
  it('one row for the school, with the pupil count', () => {
    expect(reduceFacts(facts, 'school')).toEqual([expect.objectContaining({ schoolId: 's1', sittings: 3, pupils: 2 })])
  })
  it('empty input reduces to nothing', () => {
    expect(reduceFacts([], 'user')).toEqual([])
    expect(figuresOf([])).toEqual({ sittings: 0, score: 0, max: 0, answered: 0, seconds: 0, gradedScore: 0, gradedMax: 0 })
  })
})

describe('InMemoryBijakAggregate', () => {
  it('filters state and district through the school list', async () => {
    const port = new InMemoryBijakAggregate([
      { id: 's1', name: 'a', code: null, type: 'SMK', district: 'D1', state: 'S1' },
      { id: 's2', name: 'b', code: null, type: 'SMK', district: 'D2', state: 'S1' },
    ])
    port.addSitting(sitting({ userId: '1', schoolId: 's1' })).addSitting(sitting({ userId: '2', schoolId: 's2' }))
    expect((await port.sittings({ district: 'D1' })).map((s) => s.userId)).toEqual(['1'])
    expect((await port.sittings({ state: 'S1' })).length).toBe(2)
  })
})
