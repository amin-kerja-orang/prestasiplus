/**
 * `UserMe` (M01 DATA-M01-01): the API shape of the logged-in user, returned by `GET /api/me`
 * (M01 #7), the login/register/reset responses (M01 #1, #2, #4) and cached in `pp.auth`
 * (DATA-M01-02).
 *
 * `UserMe` = every User field **except** `password`, `icNumber`, `rememberToken` and `isActive`,
 * plus `school: SchoolSummary | null` and `landingPath` (BR-07). The field list is explicit (an
 * allow-list), so a field added to the users store later is never leaked by accident.
 *
 * `school` is the M02 `SchoolSummary` projection (DATA-M01-06). Schools are owned by M02 (D12); the
 * core seeds none; `schoolSummaryOf` reads the M02 `schools` repository (F-23, `./schools.ts`).
 */

import type { MockRole } from '../auth/middleware'
import { landingPathFor } from '../auth/landing'
import { schoolSummaryOf, type SchoolSummary } from './schools'
import type { SessionUserRow } from './users'

export type { SchoolSummary }

export interface UserMe {
  id: number
  name: string
  email: string
  phone: string | null
  role: MockRole
  grade: number | null
  schoolId: number | null
  bio: string | null
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
  school: SchoolSummary | null
  landingPath: string
}

export function toUserMe(user: SessionUserRow): UserMe {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    grade: user.grade,
    schoolId: user.schoolId,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
    school: user.schoolId === null ? null : schoolSummaryOf(user.schoolId),
    landingPath: landingPathFor(user.role),
  }
}
