/**
 * SRS M17 v1.13 §7 #6–#13: the Command Center drill-down endpoints behind S4–S7 (M17-T1a).
 *
 * | # | Path | Page |
 * |---|---|---|
 * | 6 | `GET /api/command-center/school/{id}` | S4 |
 * | 7 | `GET /api/command-center/school/{sid}/teacher/{uid}` | S5 |
 * | 8 | `GET /api/command-center/classroom/{id}` | S6 |
 * | 9 | `GET /api/command-center/student/{id}` | S7 |
 * | 10 | `GET /api/command-center/student/{id}/week?start=&end=` | S7 week / all-sessions modal |
 * | 11 | `GET /api/command-center/student/{id}/subject?code=` | S7 subject modal |
 * | 12 | `GET /api/command-center/session/{sessionId}` | S7 session modal |
 * | 13 | `GET /api/command-center/headcount/{configId}` | S7 headcount modal |
 *
 * Guard **ATS**: admin, a teacher scoped by BR-M17-30 (FR-M17-60), or a school admin fixed to the session
 * school (BR-M17-34); `command-center-drill-scope.ts`. 401 without a session, 403 for any other role or a
 * school admin without a school, 404 for an unknown id or one outside the teacher's
 * scope, 422 for a bad `start` / `end`. A non-numeric id matches no route, so it is a 404 too
 * (FR-M17-07). Every handler reads the owners' repositories at `ctx.clock.now()`.
 */

import {
  int,
  notFound,
  ok,
  queryString,
  route,
  str,
  validationError,
  type RouteDef,
} from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'

import { adminTeacherOrSchoolAdmin, scopeOf, type DrillScope } from './command-center-drill-scope'
import {
  buildHeadcount,
  buildSession,
  dateKeyMs,
  sessionsBetween,
  sessionsOfSubject,
} from './command-center-drill-sessions'
import { buildClass, buildSchool, buildStudent, buildTeacher } from './command-center-drill-views'

/** "Julat tarikh tidak sah." (PROPOSED COPY, SRS §8.2 #4; the page never sends a bad range). */
export const RANGE_INVALID = 'Julat tarikh tidak sah.'

/** The pupil of a modal request when the viewer may open it, else `null` (→ 404). */
function pupilId(id: number, scope: DrillScope): number | null {
  const user = users.get(id)
  return user?.role === 'student' && scope.mayOpenStudent(id) ? id : null
}

/** Session ids are M05 strings: anchors "A2", generated "g1", runtime "s_…". */
const SESSION_ID = /[A-Za-z0-9_-]+/

export const commandCenterDrillRoutes: RouteDef[] = [
  route(
    'GET',
    '/api/command-center/school/:id',
    [adminTeacherOrSchoolAdmin],
    (req, ctx) => {
      const data = buildSchool(req.params.id as number, scopeOf(req), ctx.clock.now())
      return data ? ok(data) : notFound()
    },
    { params: { id: int() } },
  ),

  route(
    'GET',
    '/api/command-center/school/:sid/teacher/:uid',
    [adminTeacherOrSchoolAdmin],
    (req, ctx) => {
      const data = buildTeacher(
        req.params.sid as number,
        req.params.uid as number,
        scopeOf(req),
        ctx.clock.now(),
      )
      return data ? ok(data) : notFound()
    },
    { params: { sid: int(), uid: int() } },
  ),

  route(
    'GET',
    '/api/command-center/classroom/:id',
    [adminTeacherOrSchoolAdmin],
    (req, ctx) => {
      const data = buildClass(req.params.id as number, scopeOf(req), ctx.clock.now())
      return data ? ok(data) : notFound()
    },
    { params: { id: int() } },
  ),

  route(
    'GET',
    '/api/command-center/student/:id',
    [adminTeacherOrSchoolAdmin],
    (req, ctx) => {
      const data = buildStudent(req.params.id as number, scopeOf(req), ctx.clock.now())
      return data ? ok(data) : notFound()
    },
    { params: { id: int() } },
  ),

  route(
    'GET',
    '/api/command-center/student/:id/week',
    [adminTeacherOrSchoolAdmin],
    (req) => {
      const id = pupilId(req.params.id as number, scopeOf(req))
      if (id === null) return notFound()
      const start = dateKeyMs(queryString(req.query, 'start') ?? '')
      const end = dateKeyMs(queryString(req.query, 'end') ?? '')
      if (start === null || end === null || start > end) {
        return validationError({ start: RANGE_INVALID }, RANGE_INVALID)
      }
      return ok(sessionsBetween(id, start, end))
    },
    { params: { id: int() } },
  ),

  route(
    'GET',
    '/api/command-center/student/:id/subject',
    [adminTeacherOrSchoolAdmin],
    (req) => {
      const id = pupilId(req.params.id as number, scopeOf(req))
      if (id === null) return notFound()
      return ok(sessionsOfSubject(id, (queryString(req.query, 'code') ?? '').trim()))
    },
    { params: { id: int() } },
  ),

  route(
    'GET',
    '/api/command-center/session/:sessionId',
    [adminTeacherOrSchoolAdmin],
    (req) => {
      const data = buildSession(req.params.sessionId as string, scopeOf(req))
      return data ? ok(data) : notFound()
    },
    { params: { sessionId: str(SESSION_ID) } },
  ),

  route(
    'GET',
    '/api/command-center/headcount/:configId',
    [adminTeacherOrSchoolAdmin],
    (req) => {
      const data = buildHeadcount(req.params.configId as number, scopeOf(req))
      return data ? ok(data) : notFound()
    },
    { params: { configId: int() } },
  ),
]
