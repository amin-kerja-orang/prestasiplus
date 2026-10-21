import type { RoleCode } from '@pp/contract'

import { MIN_COHORT, REDACTED_NAME } from './constants'
import { shortName } from './ranking'

export { MIN_COHORT, REDACTED_NAME }

/** Roles that own the relationship with pupils: aggregates of any size, names per `canSeeName`. */
export const STAFF_ROLES: readonly RoleCode[] = ['admin', 'teacher', 'school_admin']

export const isStaff = (role: RoleCode): boolean => STAFF_ROLES.includes(role)

/** A figure backed by `pupils` distinct pupils may be shown: always to staff, to others from MIN_COHORT. */
export const meetsCohort = (role: RoleCode, pupils: number): boolean => isStaff(role) || pupils >= MIN_COHORT

/**
 * Pupil names (LEAD, OQ-7; security M1+M2): the admin, the pupil themself, a teacher for pupils of the own
 * classes (`ownPupils`) and, when `schoolPupils` is given, a school admin for pupils of the own school.
 * Officers and students never see other pupils' names. Without `schoolPupils` a school admin is trusted
 * (callers whose data is already limited to the own school: school, class and item-analysis reports).
 * Ranking and leaderboard rows span schools, so they pass `schoolPupils`.
 */
export function canSeeName(
  role: RoleCode,
  viewerId: string,
  pupilId: string,
  ownPupils: ReadonlySet<string>,
  schoolPupils?: ReadonlySet<string>,
): boolean {
  if (viewerId === pupilId) return true
  if (role === 'admin') return true
  if (role === 'school_admin') return schoolPupils === undefined || schoolPupils.has(pupilId)
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
 * Name on a ranking or leaderboard row (children's privacy): the full name when `visible` (see `canSeeName`),
 * else the first name plus the initial of the last name ("Siti N."). The `userId` of a row follows the same flag.
 */
export const displayName = (fullName: string, visible: boolean): string => (visible ? fullName : shortName(fullName))

/** A ranking scope may list pupils to a non-staff viewer only when it holds at least MIN_COHORT ranked pupils. */
export const scopeVisible = (role: RoleCode, rankedPupils: number): boolean => meetsCohort(role, rankedPupils)
