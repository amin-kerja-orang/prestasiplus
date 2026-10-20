import type { RoleCode } from '@pp/contract'

import type { ClassInfo, PupilRef } from '../ports'
import type { Ctx } from '../services/types'

/** Pure access rules. An unknown and a not-visible resource are treated alike by the callers. */

/** The school of a school-scoped caller (school, class level), else null. */
export function viewerSchoolId(ctx: Pick<Ctx, 'scope'>): string | null {
  const { scope } = ctx
  return (scope.level === 'school' || scope.level === 'class') && scope.schoolId ? scope.schoolId : null
}

/** Roles that may call the school item analysis (parent and sponsor may not). */
export const ITEM_SCHOOL_ROLES: readonly RoleCode[] = ['admin', 'teacher', 'school_admin', 'student', 'ppd_officer']
/** Roles that may call the class item analysis and the class analytics. */
export const CLASS_ANALYSIS_ROLES: readonly RoleCode[] = ['admin', 'teacher']

export const isOfficer = (role: RoleCode): boolean => role === 'ppd_officer'

/** Class dashboard (S5): admin any; teacher own; school_admin the classrooms of the own school. */
export function canOpenClassDashboard(ctx: Ctx, cls: ClassInfo): boolean {
  if (cls.kind !== 'classroom') return false
  if (ctx.role === 'admin') return true
  if (ctx.role === 'teacher') return cls.teacherId === ctx.userId
  if (ctx.role === 'school_admin') return viewerSchoolId(ctx) === cls.schoolId
  return false
}

/** Class analytics and class item analysis: admin any classroom; teacher own. */
export function canOpenClassAnalysis(ctx: Ctx, cls: ClassInfo): boolean {
  if (cls.kind !== 'classroom') return false
  if (ctx.role === 'admin') return true
  if (ctx.role === 'teacher') return cls.teacherId === ctx.userId
  return false
}

/**
 * Prestasi 360 of one pupil (a student account; the caller checks that). teaches = the pupil is an
 * active member of an active class of the caller. Officers never open a pupil: they get aggregates only.
 */
export function mayOpenStudent(ctx: Ctx, pupil: Pick<PupilRef, 'id' | 'schoolId'>, rel: { teaches: boolean }): boolean {
  if (ctx.userId === pupil.id) return true
  switch (ctx.role) {
    case 'admin':
      return true
    case 'teacher':
      return rel.teaches
    case 'school_admin': {
      const school = viewerSchoolId(ctx)
      return school !== null && pupil.schoolId === school
    }
    default:
      return false
  }
}

export type SchoolAccess = 'ok' | 'forbidden'

/**
 * School item analysis by id. admin any school; school-scoped roles their own; officers a school in
 * `officerSchoolIds`. Unknown ids are "forbidden" for everyone but admin (no existence leak).
 */
export function schoolAccess(ctx: Ctx, schoolId: string, officerSchoolIds: ReadonlySet<string>): SchoolAccess {
  if (!ITEM_SCHOOL_ROLES.includes(ctx.role)) return 'forbidden'
  if (ctx.role === 'admin') return 'ok'
  if (isOfficer(ctx.role)) return officerSchoolIds.has(schoolId) ? 'ok' : 'forbidden'
  return viewerSchoolId(ctx) === schoolId ? 'ok' : 'forbidden'
}

/**
 * State or district coverage of an officer, from the active scope. A district is matched together with
 * its state; a district scope without a state, or any other level, gives null (fail closed).
 */
export function officerCoverage(ctx: Pick<Ctx, 'scope'>): { state: string; district?: string } | null {
  const { scope } = ctx
  if (scope.level === 'district' && scope.districtCode && scope.stateCode) {
    return { state: scope.stateCode, district: scope.districtCode }
  }
  if (scope.level === 'state' && scope.stateCode) return { state: scope.stateCode }
  return null
}
