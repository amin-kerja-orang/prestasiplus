/**
 * SRS M08 v1.13 §7 #5 class dashboard (S5) and #8 class analytics (S8) (M08-T7).
 *
 * - #5: an unknown class, a school class (`sc-{id}`) or a class the viewer may not open is a 404
 *   (FR-M08-07, BR-M08-26: admin any classroom, teacher own, others none → 404).
 * - #8: admin and teacher only (§9: school admin and pelajar "none" → 403); a class the viewer may not
 *   open is a 403 (§7 #8). An unknown class id is the empty payload (SRS §8: "Tiada data analitik…"; Delivery
 *   Lead decision T7-1). Without `classroomId` a teacher gets the
 *   first own class (INFERRED: the "Kelas" select has no placeholder, so it shows its first option);
 *   the admin gets none.
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
import { classrooms } from '@/modules/m10-teacher-class/mock'

import { classAnalytics, parseRiskLevel } from '../repository/class-analytics'
import { classDashboard } from '../repository/class-performance'
import { mayOpenClass, ownClasses, viewerOf } from './common'

export const classRoutes: RouteDef[] = [
  route(
    'GET',
    '/api/performance/classes/:id',
    [requireAuth()],
    (req, ctx) => {
      const cls = classrooms.get('classroom', req.params.id as number)
      if (!cls || !mayOpenClass(viewerOf(req), cls)) return notFound()
      return ok(classDashboard(cls, ctx.clock.now()))
    },
    { params: { id: int() } },
  ),

  route('GET', '/api/analytics/classes', [requireAuth()], (req) => {
    const viewer = viewerOf(req)
    if (viewer.role !== 'admin' && viewer.role !== 'teacher') return forbidden()
    const own = ownClasses(viewer)
    const wanted = queryInt(req.query, 'classroomId')
    let cls = null
    if (wanted !== undefined) {
      const found = classrooms.get('classroom', wanted)
      if (found && !mayOpenClass(viewer, found)) return forbidden()
      cls = found ?? null
    } else if (own[0]) {
      cls = own[0]
    }
    return ok(
      classAnalytics({
        ownClasses: own.map((c) => ({ id: c.classId, name: c.name })),
        cls,
        subjectId: queryInt(req.query, 'subjectId'),
        riskLevel: parseRiskLevel(queryString(req.query, 'riskLevel')),
      }),
    )
  }),
]
