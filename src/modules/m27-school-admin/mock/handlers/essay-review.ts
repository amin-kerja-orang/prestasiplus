/**
 * Mock of the Tanda Karangan endpoints (contract `school-admin/essay-review.ts`). The mock data has no AI mark proposal
 * (no essay answers exist in M05), and a record is not invented (seed rule), so the queue is always empty and every
 * confirm is the contract's 404. School admin only, as the rest of M27 Part B.
 */

import { notFound, route, unpaged, type RouteDef } from '@/mock/define'

import { requireSchoolAdminWithSchool } from '../read-models/school-scope'

const BASE = '/api/admin-sekolah/tanda-karangan'
const guard = [requireSchoolAdminWithSchool]

export const essayReviewRoutes: RouteDef[] = [
  route('GET', BASE, guard, () => unpaged([])),
  route('POST', `${BASE}/:id/sahkan`, guard, () => notFound()),
]
