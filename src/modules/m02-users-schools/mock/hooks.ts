/**
 * M02 test hooks (`window.__mock`, dev and e2e builds; overview §6.13). Hook names are global.
 *
 * | Hook | Effect |
 * |---|---|
 * | `setParentInviteToken(studentId, token)` | L45 §7: fixes the student's invite token (any non-empty string, stored lower-case); the student must exist and be a `student`; the token must not belong to another student |
 *
 * Validates its input and throws a `RangeError` (the hook promise rejects), so a typo in a test fails at the call.
 */

import { clock } from '@/lib/time'
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

/** The plugin's `hooks` field. */
export const m02Hooks = { setParentInviteToken }
