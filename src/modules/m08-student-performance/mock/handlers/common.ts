/**
 * Helpers shared by the M08 handlers: the viewer, scope and access rules of SRS M08 §9, subject names
 * and colours from M03, and the error responses (unknown id → 404, forbidden → 403, module-wide).
 */

import type { MockRequest, MockResponse } from '@/mock/define'
import { forbidden, notFound } from '@/mock/define'
import { users, type UserRow } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { classrooms, type ClassroomRow } from '@/modules/m10-teacher-class/mock'

export interface Viewer {
  id: number
  role: NonNullable<MockRequest['session']>['role']
  user: UserRow
  schoolId: number | null
}

export function viewerOf(req: MockRequest): Viewer {
  if (!req.session) throw new Error('requireAuth() must run first')
  const user = users.get(req.session.userId)
  if (!user) throw new Error(`session user ${String(req.session.userId)} is not in the users store`)
  return { id: user.id, role: req.session.role, user, schoolId: user.schoolId }
}

export const NOT_FOUND = (): MockResponse => notFound()
export const FORBIDDEN = (): MockResponse => forbidden()

export const initialOf = (name: string): string => (name.trim()[0] ?? '?').toUpperCase()

/** The pupil's school district / state match an officer's scope (M18 roles, INFERRED). */
export function officerCovers(officer: UserRow, schoolId: number | null): boolean {
  if (schoolId === null) return false
  const school = schools.get(schoolId)
  if (!school) return false
  if (officer.role === 'ppd_officer')
    return officer.ppdDistrict !== null && school.district === officer.ppdDistrict
  if (officer.role === 'jpn_officer')
    return officer.ppdState !== null && school.state === officer.ppdState
  return false
}

/** BR-M08-26 / §9 S6: may `viewer` open the Prestasi 360 of `pupil`? */
export function mayOpenStudent(viewer: Viewer, pupil: UserRow): boolean {
  switch (viewer.role) {
    case 'admin':
      return true
    case 'teacher':
      return classrooms.teacherStudentIds(viewer.id).includes(pupil.id) || viewer.id === pupil.id
    case 'school_admin':
      return viewer.schoolId !== null && viewer.schoolId === pupil.schoolId
    case 'student':
      return viewer.id === pupil.id
    case 'ppd_officer':
    case 'jpn_officer':
      return officerCovers(viewer.user, pupil.schoolId)
    default:
      return false
  }
}

/** BR-M08-26: the classes a viewer may open by URL (S5, S11): admin any classroom, teacher own. */
export function mayOpenClass(viewer: Viewer, cls: ClassroomRow): boolean {
  if (cls.kind !== 'classroom') return false
  if (viewer.role === 'admin') return true
  return viewer.role === 'teacher' && cls.teacherId === viewer.id
}

/**
 * S5 only (M27-T0c, XR-M27-13b): `mayOpenClass` plus a school admin opening a classroom of OWN school.
 * A school admin without a school, or a class of another school, is refused as before.
 */
export function mayOpenClassDashboard(viewer: Viewer, cls: ClassroomRow): boolean {
  if (mayOpenClass(viewer, cls)) return true
  return (
    viewer.role === 'school_admin' &&
    cls.kind === 'classroom' &&
    viewer.schoolId !== null &&
    cls.schoolId === viewer.schoolId
  )
}

/** BR-M08-26 list of the classes a viewer owns / may pick from (S4 own classes: admin none). */
export function ownClasses(viewer: Viewer): ClassroomRow[] {
  if (viewer.role !== 'teacher') return []
  return classrooms.forTeacher(viewer.id).filter((c) => c.kind === 'classroom' && c.isActive)
}

const subjectNameOf = (subjectId: number | null): string | null =>
  subjectId === null ? null : (curriculum.subject(subjectId)?.name ?? null)
export { subjectNameOf }

export const subjectColorOf = (subjectId: number | null): string =>
  (subjectId === null ? undefined : curriculum.subject(subjectId)?.color) ?? '#6366F1'
