/**
 * M02 test hooks (`window.__mock`, dev and e2e builds; overview §6.13). Hook names are global.
 *
 * | Hook | Effect |
 * |---|---|
 * | `setParentInviteToken(studentId, token)` | L45 §7: fixes the student's invite token (any non-empty string, stored lower-case); the student must exist and be a `student`; the token must not belong to another student |
 *
 * | `seedSchoolAdminWithoutSchool()` | XR-M27-05: creates (once) a `school_admin` with `schoolId` null; returns `{id, email, password}` |
 *
 * Validates its input and throws a `RangeError` (the hook promise rejects), so a typo in a test fails at the call.
 */

import { clock } from '@/lib/time'
import { DEMO_PASSWORD } from '@/mock/core-data/accounts'
import { users } from '@/modules/m01-authentication/mock'

import { parentInvitesRepo } from './handlers/parent-invites-store'

/** `mock.setParentInviteToken(studentId, token)`: returns the stored token. */
export function setParentInviteToken(studentId: number, token: string): string {
  if (!Number.isInteger(studentId) || studentId < 1) {
    throw new RangeError(`setParentInviteToken: invalid studentId ${String(studentId)}`)
  }
  if (users.get(studentId)?.role !== 'student') {
    throw new RangeError(`setParentInviteToken: ${String(studentId)} is not a student`)
  }
  if (typeof token !== 'string' || token.trim() === '') {
    throw new RangeError('setParentInviteToken: the token is a non-empty string')
  }
  return parentInvitesRepo.setToken(studentId, token, clock.now()).token
}

/** The fictitious school admin without a school (XR-M27-05). */
export const ORPHAN_SCHOOL_ADMIN_EMAIL = 'admin-tanpa-sekolah@demo.test'
const ORPHAN_SCHOOL_ADMIN_NAME = 'Admin Tanpa Sekolah'

/** Return shape of `seedSchoolAdminWithoutSchool`. */
export interface SchoolAdminWithoutSchool {
  id: number
  email: string
  password: string
}

/**
 * `mock.seedSchoolAdminWithoutSchool()` (M27 SRS §6.4, XR-M27-05): one `school_admin` with `schoolId`
 * null, written through the M01 users store only. It bypasses FR-M02-27 (school required at creation)
 * for tests. Idempotent: a second call returns the same account. `mock.reset()` removes it.
 */
export function seedSchoolAdminWithoutSchool(): SchoolAdminWithoutSchool {
  const existing = users.findByEmail(ORPHAN_SCHOOL_ADMIN_EMAIL)
  const row =
    existing ??
    users.create(
      {
        name: ORPHAN_SCHOOL_ADMIN_NAME,
        email: ORPHAN_SCHOOL_ADMIN_EMAIL,
        role: 'school_admin',
        schoolId: null,
      },
      clock.now(),
    )
  if (!existing) users.setPassword(row.id, DEMO_PASSWORD)
  return { id: row.id, email: row.email, password: DEMO_PASSWORD }
}

/** The plugin's `hooks` field. */
export const m02Hooks = { setParentInviteToken, seedSchoolAdminWithoutSchool }
