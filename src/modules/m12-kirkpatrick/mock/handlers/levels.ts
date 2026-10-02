/**
 * SRS M12 v1.6 §7 #1 `GET /api/kirkpatrick/overview` (S1), #2 `reaction` (S2), #3 `learning` (S3), #4 `behavior`
 * (S4), #5 `results` (S5), #6 `chain` (S6) and #14 `filter-options`. Read-only. #1 takes `schoolId` and `state`,
 * #3-#5 `schoolId` only, #2 and #6 ignore the scope. The school administrator (INFERRED, G4 decision F6) reaches
 * #1 and #14 only (the S1 alias), forced to the own school; every other endpoint is admin and teacher only.
 */

import { ok, route, type RouteDef } from '@/mock/define'

import {
  behaviorOf,
  chainOf,
  filterOptionsOf,
  learningOf,
  overviewOf,
  reactionOf,
  resolveScope,
  resultsOf,
} from '../repository'
import { scopedRoles, scopeOf, staffRoles, viewerOf } from './common'

export const levelRoutes: RouteDef[] = [
  route('GET', '/api/kirkpatrick/overview', [scopedRoles], (req, ctx) =>
    ok(overviewOf(scopeOf(req, { allowState: true }), ctx.clock.now())),
  ),

  route('GET', '/api/kirkpatrick/reaction', [staffRoles], () => ok(reactionOf())),

  route('GET', '/api/kirkpatrick/learning', [staffRoles], (req) => ok(learningOf(scopeOf(req)))),

  route('GET', '/api/kirkpatrick/behavior', [staffRoles], (req) => ok(behaviorOf(scopeOf(req)))),

  route('GET', '/api/kirkpatrick/results', [staffRoles], (req) => ok(resultsOf(scopeOf(req)))),

  route('GET', '/api/kirkpatrick/chain', [staffRoles], () => ok(chainOf(resolveScope()))),

  route('GET', '/api/kirkpatrick/filter-options', [scopedRoles], (req) => {
    const viewer = viewerOf(req)
    // The school administrator (INFERRED) sees only the own school; without a school, none (-1 matches nothing).
    return ok(filterOptionsOf(viewer.role === 'school_admin' ? (viewer.schoolId ?? -1) : null))
  }),
]
