/**
 * M27-T0c (XR-M27-13b): S5 class dashboard access rule `mayOpenClassDashboard`: a school admin opens a
 * classroom of OWN school only; admin / teacher / other roles are unchanged.
 */

import { describe, expect, it } from 'vitest'

import type { UserRow } from '@/modules/m01-authentication/mock'
import type { ClassroomRow } from '@/modules/m10-teacher-class/mock'

import { mayOpenClass, mayOpenClassDashboard, type Viewer } from '../../mock/handlers/common'

const cls = (over: Partial<ClassroomRow> = {}): ClassroomRow =>
  ({ kind: 'classroom', classId: 1, schoolId: 900_001, teacherId: 5, ...over }) as ClassroomRow

const viewer = (role: Viewer['role'], id: number, schoolId: number | null): Viewer => ({
  id,
  role,
  user: { id, role, schoolId } as UserRow,
  schoolId,
})

describe('mayOpenClassDashboard (S5)', () => {
  it('school admin: own-school class allowed', () => {
    expect(mayOpenClassDashboard(viewer('school_admin', 8, 900_001), cls())).toBe(true)
  })

  it('school admin: foreign-school class refused', () => {
    expect(mayOpenClassDashboard(viewer('school_admin', 8, 900_001), cls({ schoolId: 8080 }))).toBe(false)
  })

  it('school admin without a school is refused (also for a class without a school)', () => {
    expect(mayOpenClassDashboard(viewer('school_admin', 8, null), cls())).toBe(false)
    expect(mayOpenClassDashboard(viewer('school_admin', 8, null), cls({ schoolId: null }))).toBe(false)
  })

  it('school admin: a school class (not a classroom) is refused', () => {
    expect(
      mayOpenClassDashboard(viewer('school_admin', 8, 900_001), cls({ kind: 'school' } as Partial<ClassroomRow>)),
    ).toBe(false)
  })

  it('existing roles unchanged: admin any, teacher own only, student / officers none', () => {
    expect(mayOpenClassDashboard(viewer('admin', 1, null), cls({ schoolId: 8080 }))).toBe(true)
    expect(mayOpenClassDashboard(viewer('teacher', 5, 900_001), cls())).toBe(true)
    expect(mayOpenClassDashboard(viewer('teacher', 6, 900_001), cls())).toBe(false)
    for (const role of ['student', 'ppd_officer', 'jpn_officer', 'parent'] as const)
      expect(mayOpenClassDashboard(viewer(role, 2, 900_001), cls())).toBe(false)
  })

  it('mayOpenClass (S8, S11) itself still refuses a school admin', () => {
    expect(mayOpenClass(viewer('school_admin', 8, 900_001), cls())).toBe(false)
  })
})
