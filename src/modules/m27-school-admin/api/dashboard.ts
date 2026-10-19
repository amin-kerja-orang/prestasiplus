/**
 * M27 S0 client (SRS M27 v1.3 §7 #1): `GET /api/admin-sekolah/dashboard`. Guard SA: `school_admin` only,
 * the school is the session user's (no parameter). Failures reject with `ApiError`: 401 without a session,
 * 403 for any other role or a school admin without a school.
 */

import { api } from '@/api'

export type SubscriptionStatus = 'none' | 'active' | 'grace' | 'expired'

export interface DashboardPerutusan {
  id: number
  title: string
  createdAt: string
  author: { initials: string; roleLabel: string }
}

export interface DashboardRisk {
  safe: number
  watch: number
  high: number
  total: number
}

export interface DashboardLevel {
  code: 't4' | 't5'
  name: string
  accuracy: number
}

export interface DashboardGrade {
  grade: string
  count: number
  pct: number
}

export interface SchoolDashboard {
  school: { id: number; name: string; state: string; ppd: string | null; code: string | null }
  roleLabel: string
  perutusan: DashboardPerutusan[]
  cards: {
    pupils: number
    teachers: number
    activeClasses: number
    subscription: { status: SubscriptionStatus; label: string }
  }
  performance: {
    gps: { value: number | null; grade: string | null; band: string | null; entries: number }
    /** The M18 `risk.forSchool` tally (XR-M27-08 resolved); `null` hides the Amaran Awal panel. */
    risk: DashboardRisk | null
    practice: { accuracy: number | null; sessions: number; questions: number }
    levels: DashboardLevel[]
    distribution: DashboardGrade[]
    total: number
  }
}

/** #1 `GET /api/admin-sekolah/dashboard` (S0). */
export const fetchSchoolDashboard = (o: { signal?: AbortSignal } = {}) =>
  api.get<SchoolDashboard>('/api/admin-sekolah/dashboard', o.signal ? { signal: o.signal } : {})
