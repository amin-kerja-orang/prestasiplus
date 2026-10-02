/**
 * The core's read of the M02 schools store, for `UserMe.school` (M01 DATA-M01-06 `SchoolSummary`).
 *
 * Schools are owned by M02 (D12; overview X-2): the canonical schools 900001 "SMK DEMO",
 * 900002 "SK Demo" and 900004 "SK Demo Bestari" (account 4) are anchors of the M02 schools
 * dataset (F-23). The core keeps no copy of a school: `schoolSummaryOf` is the projection of
 * `schools.summary(id)` from `@/modules/m02-users-schools/mock` → `{id, name, code, type, state,
 * district, city}`.
 */

import { schools, type SchoolSummary } from '@/modules/m02-users-schools/mock'

export type { SchoolSummary }

/** The summary of school `id`, or `null` (unknown id). */
export function schoolSummaryOf(id: number): SchoolSummary | null {
  return schools.summary(id)
}
