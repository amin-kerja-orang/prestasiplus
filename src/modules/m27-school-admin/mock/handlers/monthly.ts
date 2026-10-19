/** SRS M27 Part B §19 #5 `GET /api/admin-sekolah/laporan-bulanan` (S5). Guard SA. */

import { ok, queryString, route, type RouteDef } from '@/mock/define'

import { buildMonthlyReport } from '../read-models/monthly'
import { requireSchoolAdminWithSchool, schoolOf } from '../read-models/school-scope'

export const monthlyRoutes: RouteDef[] = [
  route('GET', '/api/admin-sekolah/laporan-bulanan', [requireSchoolAdminWithSchool], (req, ctx) =>
    ok(buildMonthlyReport(schoolOf(req), queryString(req.query, 'bulan'), ctx.clock.now())),
  ),
]
