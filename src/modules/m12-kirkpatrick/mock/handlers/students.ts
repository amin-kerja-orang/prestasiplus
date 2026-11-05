/**
 * SRS M12 v1.6 §7 #10 `GET /api/kirkpatrick/students/:id` (S8) and #11 `GET /api/kirkpatrick/me` (S9).
 *
 * #10: admin, teacher and school administrator (S6-T02). For a teacher and a school administrator an id that is
 * not a pupil of the viewer's school (unknown, not a pupil, or another school) answers one uniform `404 NOT_FOUND`
 * (D-T02-2, ERR-ACC-02), so the ids cannot be probed; the admin keeps `403 FORBIDDEN` for an id that is not a pupil.
 * A non-numeric id has no route (404, FR-M12-14). #11: the current user, any logged-in user.
 */

import { forbidden, int, notFound, ok, requireAuth, route, type RouteDef } from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'

import { myOf, studentOf } from '../repository'
import { outsideSchool, scopedRoles, viewerOf } from './common'

export const studentRoutes: RouteDef[] = [
  route(
    'GET',
    '/api/kirkpatrick/students/:id',
    [scopedRoles],
    (req, ctx) => {
      const viewer = viewerOf(req)
      const refuse = () => (viewer.role === 'admin' ? forbidden() : notFound())
      const id = Number(req.params.id)
      const user = users.get(id)
      if (!user || user.role !== 'student' || outsideSchool(viewer, user.schoolId)) return refuse()
      const model = studentOf(id, ctx.clock.now())
      return model ? ok(model) : refuse()
    },
    { params: { id: int() } },
  ),

  route('GET', '/api/kirkpatrick/me', [requireAuth()], (req, ctx) =>
    ok(myOf(viewerOf(req).id, ctx.clock.now())),
  ),
]
