/**
 * M10 test hooks (`window.__mock`, dev and e2e builds; SRS M10 v1.18 §6.12). Hook names are global,
 * so they are the ones the SRS names. M10-T1 provides:
 *
 * | Hook | Effect |
 * |---|---|
 * | `enrol(userId, classCode)` | a runtime join as S33 does it (the S33 / S34 provisional E2E): source `code` |
 *
 * It validates its input and throws a `RangeError` / `TypeError`, so a typo in a test fails at the
 * call. The time is the shared mock clock. The other hooks of §6.12 belong to the tasks that build
 * the screens they serve.
 */

import { clock } from '@/lib/time'
import { users } from '@/modules/m01-authentication/mock'

import { joinByCode } from '../handlers/student-side'

/** `mock.enrol` (SRS §6.12). Returns the joined classroom id. */
export function enrol(userId: number, classCode: string): { classroomId: number } {
  if (!Number.isInteger(userId) || userId < 1) {
    throw new RangeError(`enrol: invalid userId ${String(userId)}`)
  }
  if (!users.get(userId)) throw new RangeError(`enrol: unknown user ${String(userId)}`)
  if (typeof classCode !== 'string' || classCode.trim() === '') {
    throw new TypeError('enrol: expected a class code')
  }
  const result = joinByCode(userId, classCode, clock.now())
  if (!result.ok) throw new RangeError(`enrol: ${result.message}`)
  return { classroomId: result.classroomId }
}

export const m10Hooks = { enrol }
