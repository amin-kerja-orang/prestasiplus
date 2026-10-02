/**
 * SRS M12 v1.6 §7 #10 `GET /api/kirkpatrick/students/:id` (S8) and #11 `GET /api/kirkpatrick/me` (S9).
 *
 * #10: admin and teacher (provisional); the school administrator is refused (G4 decision F6: it reaches #1 and #14
 * only). One uniform `403 FORBIDDEN` answers "not a user" and "not a student" (FR-M12-17, SEC-M12-02), so the ids cannot be probed; a non-numeric id has no route (404, FR-M12-14). #11: the current
 * user, any logged-in user.
 */

import { forbidden, int, ok, requireAuth, route, type RouteDef } from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'

import { myOf, studentOf } from '../repository'
import { staffRoles, viewerOf } from './common'

export const studentRoutes: RouteDef[] = [
  route(
    'GET',
    '/api/kirkpatrick/students/:id',
    [staffRoles],
    (req, ctx) => {
      const id = Number(req.params.id)
      const user = users.get(id)
      if (!user || user.role !== 'student') return forbidden()
      const model = studentOf(id, ctx.clock.now())
      return model ? ok(model) : forbidden()
    },
    { params: { id: int() } },
  ),

  route('GET', '/api/kirkpatrick/me', [requireAuth()], (req, ctx) =>
    ok(myOf(viewerOf(req).id, ctx.clock.now())),
  ),
]
