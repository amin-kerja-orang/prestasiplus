/**
 * Role-dependent targets and query for the M18 report screens S23 / S21 (roles: school_admin, teacher, admin).
 * A missing role (not expected inside the guarded routes) behaves as the school admin.
 */
import { computed } from 'vue'

import { useSession } from '@/composables/useSession'

import type { AmaranSummaryQuery } from '../api/amaran'

const BACK: Record<string, string> = { teacher: '/guru', admin: '/admin' }

export function useReportViewer() {
  const { role } = useSession()
  return {
    isTeacher: computed(() => role.value === 'teacher'),
    isAdmin: computed(() => role.value === 'admin'),
    /** Where "Kembali" goes without in-app history: the viewer's own home (S4 is only for the school admin). */
    backPath: computed(() => BACK[role.value ?? ''] ?? '/amaran/sekolah'),
  }
}

type Raw = string | null | (string | null)[] | undefined
const first = (v: Raw): string | undefined => {
  const s = Array.isArray(v) ? v[0] : v
  return typeof s === 'string' && s !== '' ? s : undefined
}

/** The admin S23 query from the URL (`school_id` is the SRS spelling, `schoolId` the contract's). */
export function adminSummaryQuery(query: Record<string, Raw>): AmaranSummaryQuery {
  const out: AmaranSummaryQuery = {}
  const scope = first(query.scope)
  const schoolId = first(query.schoolId) ?? first(query.school_id)
  const district = first(query.district)
  const state = first(query.state)
  if (scope) out.scope = scope
  if (schoolId) out.schoolId = schoolId
  if (district) out.district = district
  if (state) out.state = state
  return out
}
