import type { RoleCode } from '@pp/contract'

import { MIN_COHORT, REDACTED_NAME } from './constants'

export { MIN_COHORT, REDACTED_NAME }

/** Roles that own the relationship with pupils: aggregates of any size, names per `canSeeName`. */
export const STAFF_ROLES: readonly RoleCode[] = ['admin', 'teacher', 'school_admin']

export const isStaff = (role: RoleCode): boolean => STAFF_ROLES.includes(role)

/** A figure backed by `pupils` distinct pupils may be shown: always to staff, to others from MIN_COHORT. */
export const meetsCohort = (role: RoleCode, pupils: number): boolean => isStaff(role) || pupils >= MIN_COHORT

/**
 * Pupil names (LEAD, OQ-7): the admin, the school admin, the pupil themself, and a teacher for pupils of
 * the own classes (`ownPupils`). Officers and students never see other pupils' names.
 */
export function canSeeName(role: RoleCode, viewerId: string, pupilId: string, ownPupils: ReadonlySet<string>): boolean {
  if (viewerId === pupilId) return true
  if (role === 'admin' || role === 'school_admin') return true
  if (role === 'teacher') return ownPupils.has(pupilId)
  return false
}

export const nameFor = (name: string, visible: boolean): string => (visible ? name : REDACTED_NAME)

/**
 * One rule for every endpoint that shows a level's figures (school, levels, level detail): a non-staff
 * viewer sees them only when the level has at least MIN_COHORT contributors AND no class of it has 1 to
 * 4 contributors (else level minus the shown classes would isolate that class). Staff always see them.
 */
export function levelVisibleToNonStaff(role: RoleCode, levelContributors: number, classContributors: readonly number[]): boolean {
  if (isStaff(role)) return true
  if (levelContributors < MIN_COHORT) return false
  return classContributors.every((n) => n === 0 || n >= MIN_COHORT)
}

/**
 * Name on a ranking row (OQ-7): staff and the pupil themself see the full name, everyone else the first name
 * plus the initial of the last name (`shortened`, from `shortName` in ranking.ts).
 */
export function displayName(role: RoleCode, viewerId: string, pupilId: string, fullName: string, shortened: string): string {
  return isStaff(role) || viewerId === pupilId ? fullName : shortened
}

/** A ranking scope may list pupils to a non-staff viewer only when it holds at least MIN_COHORT ranked pupils. */
export const scopeVisible = (role: RoleCode, rankedPupils: number): boolean => meetsCohort(role, rankedPupils)
