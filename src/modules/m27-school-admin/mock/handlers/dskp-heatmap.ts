/** SRS M27 Part B §19 #3 `GET /api/admin-sekolah/dskp-heatmap` (S2). Guard SA. */

import { ok, queryString, route, type RouteDef } from '@/mock/define'

import { buildSchoolDskpHeatmap } from '../read-models/dskp-heatmap'
import { reportSchoolOf, requireSchoolAdminOrAdminReport } from '../read-models/school-scope'

export const dskpHeatmapRoutes: RouteDef[] = [
  route('GET', '/api/admin-sekolah/dskp-heatmap', [requireSchoolAdminOrAdminReport], (req) =>
    ok(
      buildSchoolDskpHeatmap(reportSchoolOf(req), {
        subjectId: queryString(req.query, 'subjectId'),
        tingkatan: queryString(req.query, 'tingkatan'),
      }),
    ),
  ),
]
