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
