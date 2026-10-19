/**
 * Guards and the viewer of the M11 handlers (SRS M11 v1.10 §9, FR-M11-08).
 *
 * - **T** guard (M10 §7): admin and teacher; every other role gets 403 (S1, S6).
 * - Monitoring guard: admin (all schools), teacher (same data, provisional, OQ-M11-02) and — **INFERRED**,
 *   Delivery Lead decision for the `/admin-sekolah/monitoring` alias (build-plan v1.12 R.1.3; the SRS §9
 *   amendment is separate) — the school admin, whose scope is forced to the viewer's own school.
 */

import type { MockRequest } from '@/mock/define'
import { requireRole } from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'

export const teacherGuard = requireRole('admin', 'teacher')
export const monitoringGuard = requireRole('admin', 'teacher', 'school_admin')

export interface M11Viewer {
  id: number
  role: string
  /** The viewer's school (the school admin's forced scope). */
  schoolId: number | null
}

export function viewerOf(req: MockRequest): M11Viewer {
  if (!req.session) throw new Error('a guard must run first')
  const user = users.get(req.session.userId)
  return { id: req.session.userId, role: req.session.role, schoolId: user?.schoolId ?? null }
}

/**
 * The forced school of a monitoring request (INFERRED): the school admin's own school; `undefined`
 * (all schools) for the admin and the teacher. A school admin without a school gets school id 0, which
 * matches no school (an empty view).
 */
export const scopeOf = (viewer: M11Viewer): number | undefined =>
  viewer.role === 'school_admin' ? (viewer.schoolId ?? 0) : undefined
