/**
 * M08 test hooks (`window.__mock`, dev and e2e builds; SRS M08 v1.11 §6.11). `mock.reset()` and
 * `mock.setNow` are the mock core's (M05); the M08 hooks are:
 *
 * | Hook | Effect |
 * |---|---|
 * | `setUserSchool(userId, schoolId)` | moves a user to a school (the S9 own-school populated view in tests) through the M01 users store |
 * | `stubShare(enabled)` | S18 "Kongsi": `true` makes `navigator.share` count as available (state read by `shareStubbed()`) |
 * | `clipboard()` | the text last recorded by `recordClipboard` (the S16 copy button and the S18 fallback), or `null` |
 *
 * `stubShare` and `clipboard` hold state only and are NOT used by the M08-T3 pages (UI code never imports `mock/`): E2E
 * grants the clipboard permissions and injects `navigator.share` with `page.addInitScript` instead. Each validates its input.
 */

import { clock } from '@/lib/time'
import { users } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'

let shareStub = false
let lastClipboard: string | null = null

export const shareStubbed = (): boolean => shareStub
export const recordClipboard = (text: string): void => {
  lastClipboard = text
}
export const resetHookState = (): void => {
  shareStub = false
  lastClipboard = null
}

export function setUserSchool(userId: number, schoolId: number | null): void {
  if (!Number.isInteger(userId) || !users.get(userId)) {
    throw new RangeError(`setUserSchool: unknown user ${String(userId)}`)
  }
  if (schoolId !== null && (!Number.isInteger(schoolId) || !schools.get(schoolId))) {
    throw new RangeError(`setUserSchool: unknown school ${String(schoolId)}`)
  }
  users.update(userId, { schoolId }, clock.now())
}

export function stubShare(enabled: boolean): void {
  if (typeof enabled !== 'boolean') throw new TypeError('stubShare: expected a boolean')
  shareStub = enabled
}

export function clipboard(): string | null {
  return lastClipboard
}

export const m08Hooks = { setUserSchool, stubShare, clipboard }
