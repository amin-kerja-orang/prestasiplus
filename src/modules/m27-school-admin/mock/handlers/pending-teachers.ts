/**
 * Mock of the pending-teacher endpoints (contract `school-admin/pending-teachers.ts`, BE-21 AC 13).
 * The mock data has no self-registered, not-yet-verified teacher (no pending state exists in M01/M02), and a
 * record is not invented (seed rule), so the list is always empty and every verify is the contract's 404.
 * Guard SA as the rest of M27 Part B. Registered before the `/guru/:id` routes.
 */

import { notFound, route, unpaged, type RouteDef } from '@/mock/define'

import { requireSchoolAdminWithSchool } from '../read-models/school-scope'

const BASE = '/api/admin-sekolah/guru'
const guard = [requireSchoolAdminWithSchool]

export const pendingTeacherRoutes: RouteDef[] = [
  route('GET', `${BASE}/pending`, guard, () => unpaged([])),
  route('POST', `${BASE}/:id/verify`, guard, () => notFound()),
]
