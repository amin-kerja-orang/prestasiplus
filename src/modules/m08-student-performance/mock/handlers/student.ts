/**
 * SRS M08 v1.11 §7 #6 Prestasi 360 (S6) and #7 Analitik Pembelajaran (S7). #6: an unknown user id is a
 * 404, a pupil the viewer may not open is a 403 (§9: admin any; teacher pupils of own classes; school
 * admin pupils of the own school; pelajar self only; PPD / JPN officers pupils in scope). #7 is the
 * viewer's own analytics.
 */

import { forbidden, int, notFound, ok, requireAuth, route, type RouteDef } from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'

import { analyticsOf } from '../repository/analytics'
import { studentPerformance } from '../repository/student'
import { mayOpenStudent, viewerOf } from './common'

export const studentRoutes: RouteDef[] = [
  route(
    'GET',
    '/api/performance/students/:userId',
    [requireAuth()],
    (req, ctx) => {
      const pupil = users.get(req.params.userId as number)
      if (!pupil) return notFound()
      if (!mayOpenStudent(viewerOf(req), pupil)) return forbidden()
      return ok(studentPerformance(pupil, ctx.clock.now()))
    },
    { params: { userId: int() } },
  ),

  route('GET', '/api/analytics/me', [requireAuth()], (req, ctx) =>
    ok(analyticsOf(viewerOf(req).user, ctx.clock.now())),
  ),
]
