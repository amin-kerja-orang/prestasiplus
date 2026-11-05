/** SRS M27 Part B §19 #5 `GET /api/admin-sekolah/laporan-bulanan` (S5). Guard SA. */

import { ok, queryString, route, type RouteDef } from '@/mock/define'

import { buildMonthlyReport } from '../read-models/monthly'
import { reportSchoolOf, requireSchoolAdminOrAdminReport } from '../read-models/school-scope'

export const monthlyRoutes: RouteDef[] = [
  route('GET', '/api/admin-sekolah/laporan-bulanan', [requireSchoolAdminOrAdminReport], (req, ctx) =>
    ok(buildMonthlyReport(reportSchoolOf(req), queryString(req.query, 'bulan'), ctx.clock.now())),
  ),
]
