/** SRS M27 Part B §19 #2 `GET /api/admin-sekolah/usage` (S1). Guard SA; the school is the session's. */

import { ok, queryString, route, type RouteDef } from '@/mock/define'

import { reportSchoolOf, requireSchoolAdminOrAdminReport } from '../read-models/school-scope'
import { buildSchoolUsage, parsePeriod } from '../read-models/usage'

export const usageRoutes: RouteDef[] = [
  route('GET', '/api/admin-sekolah/usage', [requireSchoolAdminOrAdminReport], (req, ctx) =>
    ok(
      buildSchoolUsage(
        reportSchoolOf(req),
        parsePeriod(queryString(req.query, 'period')),
        ctx.clock.now(),
      ),
    ),
  ),
]
