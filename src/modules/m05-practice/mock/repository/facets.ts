/**
 * Spec facets of a row from its user and time (SRS M05 §6.14.1 populations; `../datasets/types.ts`):
 * used for anchors (when the datasets compile) and for runtime rows (session start, check, submit,
 * the test hooks). Reads the M01 users store at call time (D12).
 */

import type { UserRow } from '@/modules/m01-authentication/mock'
import { users } from '@/modules/m01-authentication/mock'

import { PIN_NOW, bandOf, weekOf } from '../datasets/calendar'
import type { SpecFacets } from '../datasets/types'

export const FIXTURE_SCHOOLS = { min: 900_001, max: 900_099 } as const

export const isFixtureSchool = (schoolId: number | null): boolean =>
  schoolId !== null && schoolId >= FIXTURE_SCHOOLS.min && schoolId <= FIXTURE_SCHOOLS.max

/** M11 BR-M11-08 / BR-M11-34: a student of grade 10 or 11 at a school outside the fixtures. */
export function inSegment(u: Pick<UserRow, 'role' | 'grade' | 'schoolId'>): boolean {
  return (
    u.role === 'student' &&
    (u.grade === 10 || u.grade === 11) &&
    u.schoolId !== null &&
    !isFixtureSchool(u.schoolId)
  )
}

/** M17 BR-M17-03/04 population P: an active student outside the fixture schools. */
export function inPopulationP(u: Pick<UserRow, 'role' | 'isActive' | 'schoolId'>): boolean {
  return u.role === 'student' && u.isActive && !isFixtureSchool(u.schoolId)
}

/**
 * Facets of a row of `userId` at `ms`. Rows of P carry their week and band (after the clock: the
 * week by time, band 0); other rows carry none.
 */
export function specFacetsFor(userId: number, ms: number): SpecFacets {
  const u = users.get(userId)
  if (!u) throw new Error(`M05 practice: unknown user ${String(userId)}`)
  const seg = inSegment(u)
  const p = inPopulationP(u)
  return {
    seg: seg ? 'mon' : 'oth',
    schoolId: seg ? u.schoolId : null,
    week: p ? weekOf(ms) : null,
    band: p ? (ms > PIN_NOW ? 0 : bandOf(ms)) : null,
    inP: p,
  }
}
