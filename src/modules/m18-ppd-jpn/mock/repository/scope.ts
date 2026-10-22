/**
 * Who may open which school / scope on the Amaran endpoints (SRS M18 BR-M18-01, §9, FR-M18-09).
 * Admin behaviour is OBSERVED, every other cell INFERRED (provisional, OQ-M18-01). Pure functions of
 * the viewer and the owners' stores.
 */

import type { UserRow } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import type { RiskScope } from './types'

// v2 (DV-M18-48 / DV-M18-49): the API has no admin school and no admin default scope, so the live fixed
// admin previews (school 127 on S21, PPD BATANG PADANG on S23) are not mirrored: admin must pass `scope`.

/** May `viewer` open the Amaran data of `schoolId`? (the school exists) */
export function mayOpenSchool(viewer: UserRow, schoolId: number): boolean {
  switch (viewer.role) {
    case 'admin':
      return true
    case 'school_admin':
      return viewer.schoolId === schoolId
    case 'teacher':
      // Schools of the teacher's own classes (INFERRED); a teacher's own school counts too.
      return (
        viewer.schoolId === schoolId ||
        classrooms.forTeacher(viewer.id).some((c) => c.schoolId === schoolId)
      )
    case 'ppd_officer': {
      const s = schools.get(schoolId)
      return (
        s !== undefined &&
        viewer.ppdDistrict !== null &&
        s.district === viewer.ppdDistrict &&
        (viewer.ppdState === null || s.state === viewer.ppdState)
      )
    }
    case 'jpn_officer': {
      const s = schools.get(schoolId)
      return s !== undefined && viewer.ppdState !== null && s.state === viewer.ppdState
    }
    default:
      return false
  }
}

/** The CSV #30 matrix: admin, officers in scope, school admin own school; teachers only #29 (403 here). */
export function mayExportSchool(viewer: UserRow, schoolId: number): boolean {
  return viewer.role !== 'teacher' && mayOpenSchool(viewer, schoolId)
}

/** S21 / #24: the school of the viewer; admin and officers have none (403). */
export function ownSchoolOf(viewer: UserRow): number | null {
  if (viewer.role === 'school_admin' || viewer.role === 'teacher') return viewer.schoolId
  return null
}

/** May `viewer` open the executive summary of `scope`? */
export function mayOpenScope(viewer: UserRow, scope: RiskScope): boolean {
  if (scope.kind === 'school') return mayOpenSchool(viewer, scope.schoolId)
  switch (viewer.role) {
    case 'admin':
      return true
    case 'ppd_officer':
      return (
        scope.kind === 'district' &&
        viewer.ppdDistrict === scope.district &&
        (viewer.ppdState === null || viewer.ppdState === scope.state)
      )
    case 'jpn_officer':
      return viewer.ppdState === scope.state
    default:
      return false
  }
}

/** The default scope of #22 without `scope`: the officer's own, else the own school; none for the admin (403). */
export function defaultScope(viewer: UserRow): RiskScope | null {
  switch (viewer.role) {
    case 'ppd_officer':
      return viewer.ppdDistrict !== null && viewer.ppdState !== null
        ? { kind: 'district', district: viewer.ppdDistrict, state: viewer.ppdState }
        : null
    case 'jpn_officer':
      return viewer.ppdState !== null ? { kind: 'state', state: viewer.ppdState } : null
    case 'school_admin':
    case 'teacher':
      return viewer.schoolId !== null ? { kind: 'school', schoolId: viewer.schoolId } : null
    default:
      return null
  }
}
