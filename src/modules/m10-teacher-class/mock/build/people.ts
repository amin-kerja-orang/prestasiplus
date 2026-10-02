/**
 * The people the M10 build reads from the M01 users repository (D12: through the public contract
 * only). A snapshot of the fields the class and enrolment build needs, never population counts.
 */

import { users, type UserRow } from '@/modules/m01-authentication/mock'

import { isReservedUser } from '../data/spec'

export interface Pupil {
  id: number
  schoolId: number | null
  grade: number | null
  isActive: boolean
  hasLoggedIn: boolean
  pool: UserRow['pool']
  isComplimentary: boolean
  /** `pelajar######@demo.test` outside the anchor blocks: a generated row. */
  generated: boolean
}

export interface Teacher {
  id: number
  schoolId: number | null
  isActive: boolean
  hasLoggedIn: boolean
  /** `guru####@demo.test`: a generated row. */
  generated: boolean
}

export interface People {
  pupils: readonly Pupil[]
  pupilById: ReadonlyMap<number, Pupil>
  teachers: readonly Teacher[]
  teacherById: ReadonlyMap<number, Teacher>
}

const pad = (n: number, w: number) => String(n).padStart(w, '0')

export function loadPeople(): People {
  const pupils: Pupil[] = users.query('U-ROLE', { sort: 'id' }, 'student').rows.map((u) => ({
    id: u.id,
    schoolId: u.schoolId,
    grade: u.grade,
    isActive: u.isActive,
    hasLoggedIn: u.hasLoggedIn,
    pool: u.pool,
    isComplimentary: u.isComplimentary,
    generated: !isReservedUser(u.id) && u.email === `pelajar${pad(u.id, 6)}@demo.test`,
  }))
  const teachers: Teacher[] = users.query('U-ROLE', { sort: 'id' }, 'teacher').rows.map((u) => ({
    id: u.id,
    schoolId: u.schoolId,
    isActive: u.isActive,
    hasLoggedIn: u.hasLoggedIn,
    generated: !isReservedUser(u.id) && u.email === `guru${pad(u.id, 4)}@demo.test`,
  }))
  return {
    pupils,
    pupilById: new Map(pupils.map((p) => [p.id, p])),
    teachers,
    teacherById: new Map(teachers.map((t) => [t.id, t])),
  }
}
