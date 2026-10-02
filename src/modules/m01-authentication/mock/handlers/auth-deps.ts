/**
 * The M01 auth handlers' reads and hand-offs into other modules, in one place (D12: only through
 * `@/modules/<slug>/mock`). Every function is used at request time, never at import time, so the
 * import cycles between the mock entries (M01 → M02/M03/M04/M14 → M01) stay harmless.
 */

import { curriculum } from '@/modules/m03-curriculum/mock'
import { questions } from '@/modules/m04-question-bank/mock'
import { gamification, referrals } from '@/modules/m14-gamification/mock'
import { schools } from '@/modules/m02-users-schools/mock'

import type { PlatformStats } from '../../api/types'

/** M02 `schools.get`: does school `id` exist (BR-04 / BR-14 "must exist")? */
export function schoolExists(id: number): boolean {
  return schools.get(id) !== undefined
}

/**
 * DATA-M01-07 / FR-M01-11 / BR-21: derived per request, never stored (DV-05, D11).
 * `questionCount` = the M04 named query Q-ELIGIBLE (status approved ∧ active, 128,989),
 * `subjectCount` / `levelCount` = the active M03 subjects (31) and education levels (11), the
 * same sets as `/api/subjects` and `/api/education-levels`.
 */
export function platformStats(): PlatformStats {
  return {
    questionCount: questions.count('Q-ELIGIBLE'),
    subjectCount: curriculum.subjects({ active: true }).length,
    levelCount: curriculum.levels({ active: true }).length,
  }
}

/**
 * FR-M01-69 / BR-26: M14 `gamification.onLogin(userId, at)` after every successful **password**
 * login (login, register, token reset / IC reset auto-login), once, with the time written to
 * `lastLoginAt`. A failure inside the hook never blocks the login.
 */
export function notifyLogin(userId: number, at: number): void {
  try {
    gamification.onLogin(userId, at)
  } catch {
    // FR-M01-69: the login goes on.
  }
}

/**
 * FR-M01-70 (provisional): M14 `referrals.onRegistered(newUserId, code)` after the user is
 * created. An unknown code is ignored by M14; a failure never blocks the registration.
 */
export function notifyRegistered(newUserId: number, referralCode: string | null): void {
  try {
    referrals.onRegistered(newUserId, referralCode)
  } catch {
    // FR-M01-70: the registration goes on.
  }
}
