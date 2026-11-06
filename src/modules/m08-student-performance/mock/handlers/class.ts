/**
 * SRS M08 v1.13 §7 #5 class dashboard (S5) and #8 class analytics (S8) (M08-T7).
 *
 * - #5: an unknown class, a school class (`sc-{id}`) or a class the viewer may not open is a 404
 *   (FR-M08-07, BR-M08-26: admin any classroom, teacher own, others none → 404).
 * - #8: admin, teacher and (R1-AS-5) school admin of the own school; pelajar "none" → 403; a class the viewer
 *   may not open is a 403 (§7 #8). An unknown class id is the empty payload (SRS §8; Delivery Lead decision
 *   T7-1). Without `classroomId` ("Semua Kelas") a teacher gets every own class, the school admin every class
 *   of the own school; the admin gets none.
 */

import {
  forbidden,
  int,
  notFound,
  ok,
  queryInt,
  queryString,
  requireAuth,
  route,
  type RouteDef,
} from '@/mock/define'
import { classrooms, type ClassroomRow } from '@/modules/m10-teacher-class/mock'

import { classAnalytics, parseRiskLevel } from '../repository/class-analytics'
import { classDashboard } from '../repository/class-performance'
import { mayOpenClassAnalysis, mayOpenClassDashboard, ownClasses, ownSchoolClasses, viewerOf } from './common'

export const classRoutes: RouteDef[] = [
  route(
    'GET',
    '/api/performance/classes/:id',
    [requireAuth()],
    (req, ctx) => {
      const cls = classrooms.get('classroom', req.params.id as number)
      if (!cls || !mayOpenClassDashboard(viewerOf(req), cls)) return notFound()
      return ok(classDashboard(cls, ctx.clock.now()))
    },
    { params: { id: int() } },
  ),

  route('GET', '/api/analytics/classes', [requireAuth()], (req) => {
    const viewer = viewerOf(req)
    if (viewer.role !== 'admin' && viewer.role !== 'teacher' && viewer.role !== 'school_admin') return forbidden()
    const isSchoolAdmin = viewer.role === 'school_admin'
    // The school admin picks among the classrooms of the OWN school, Tingkatan then name (R1-AS-5).
    const own = isSchoolAdmin ? ownSchoolClasses(viewer) : ownClasses(viewer)
    const wanted = queryInt(req.query, 'classroomId')
    let scope: ClassroomRow[] = own
    if (wanted !== undefined) {
      const found = classrooms.get('classroom', wanted)
      // An unknown class is the empty payload (T7-1); an existing one the viewer may not open is 403.
      if (found && !mayOpenClassAnalysis(viewer, found)) return forbidden()
      scope = found ? [found] : []
    }
    return ok(
      classAnalytics({
        ownClasses: own.map((c) => ({ id: c.classId, name: c.name })),
        scope,
        classroomId: wanted !== undefined && scope.length > 0 ? wanted : null,
        subjectId: queryInt(req.query, 'subjectId'),
        riskLevel: parseRiskLevel(queryString(req.query, 'riskLevel')),
        withClassNames: isSchoolAdmin,
      }),
    )
  }),
]
