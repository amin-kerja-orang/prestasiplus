/**
 * Landing path per role (M01 BR-07; overview §5.4 "Landing path"). Defined once here and returned
 * by the mock in `UserMe.landingPath`; the client never computes it itself, so a backend can own
 * it later.
 *
 * | Role | Landing | Source |
 * |---|---|---|
 * | `admin` | `/admin` | OBSERVED |
 * | `ppd_officer` | `/ppd/dashboard` | INFERRED |
 * | `jpn_officer` | `/jpn/dashboard` | INFERRED |
 * | `student`, `teacher`, `parent`, `sponsor`, `school_admin` | `/dashboard` | INFERRED (URS OQ-3) |
 */

import type { MockRole } from './middleware'

export const LANDING_PATHS: Readonly<Record<MockRole, string>> = Object.freeze({
  admin: '/admin',
  ppd_officer: '/ppd/dashboard',
  jpn_officer: '/jpn/dashboard',
  student: '/dashboard',
  teacher: '/dashboard',
  parent: '/dashboard',
  sponsor: '/dashboard',
  school_admin: '/dashboard',
})

export function landingPathFor(role: MockRole): string {
  return LANDING_PATHS[role]
}
