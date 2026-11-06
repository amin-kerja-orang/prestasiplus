import { computed, type ComputedRef } from 'vue'

import { useSessionStore } from '@/stores/session'

/**
 * Roles that may open `/headcount*` (routes/headcount.ts, SRS M08 §9, OD-R3): admin, teacher, school admin,
 * and the pupil for the two read screens (`/headcount`, `/headcount/student/{ownId}`; S10-T09). The route
 * map decides the rest: a pupil still gets the 403 page on dashboard, create, `:id`, summary and export.
 */
export const HEADCOUNT_ROLES: readonly string[] = ['admin', 'teacher', 'school_admin', 'student']

export const canOpenHeadcount = (role: string | null): boolean =>
  role !== null && HEADCOUNT_ROLES.includes(role)

/**
 * The school admin reads the school's Headcount but never writes it (R1-AS-3, AC-AS-3-3): every write
 * control is absent from the DOM. The API refuses the writes with 403 as well.
 */
export function useHeadcountReadOnly(): ComputedRef<boolean> {
  const session = useSessionStore()
  return computed(() => session.role === 'school_admin')
}
