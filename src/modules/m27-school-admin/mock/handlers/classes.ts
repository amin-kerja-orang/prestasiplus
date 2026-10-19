/** SRS M27 Part B §19 #16 `GET /api/admin-sekolah/kelas` (S8). Guard SA. */

import { list, queryString, route, type RouteDef } from '@/mock/define'

import { listSchoolClasses } from '../read-models/classes'
import { requireSchoolAdminWithSchool, schoolOf } from '../read-models/school-scope'

export const classRoutes: RouteDef[] = [
  route('GET', '/api/admin-sekolah/kelas', [requireSchoolAdminWithSchool], (req) => {
    const out = listSchoolClasses(schoolOf(req), {
      level: queryString(req.query, 'level'),
      search: queryString(req.query, 'search'),
      page: queryString(req.query, 'page'),
    })
    return list(out.data, out.meta, { tiles: out.tiles, levels: out.levels })
  }),
]
