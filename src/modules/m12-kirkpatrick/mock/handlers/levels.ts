/**
 * SRS M12 v1.6 §7 #1 `GET /api/kirkpatrick/overview` (S1), #2 `reaction` (S2), #3 `learning` (S3), #4 `behavior`
 * (S4), #5 `results` (S5), #6 `chain` (S6) and #14 `filter-options`. Read-only. #1 takes `schoolId` and `state`,
 * #3-#5 `schoolId` only, #2 and #6 ignore the query. Admin, teacher and school administrator reach every endpoint;
 * the school administrator is forced to the own school on all of them (S6-T02).
 */

import { ok, route, type RouteDef } from '@/mock/define'

import {
  behaviorOf,
  chainOf,
  filterOptionsOf,
  learningOf,
  overviewOf,
  reactionOf,
  resultsOf,
} from '../repository'
import { scopedRoles, scopeOf, viewerOf, viewerScope } from './common'

export const levelRoutes: RouteDef[] = [
  route('GET', '/api/kirkpatrick/overview', [scopedRoles], (req, ctx) =>
    ok(overviewOf(scopeOf(req, { allowState: true }), ctx.clock.now())),
  ),

  route('GET', '/api/kirkpatrick/reaction', [scopedRoles], (req) => ok(reactionOf(viewerScope(req)))),

  route('GET', '/api/kirkpatrick/learning', [scopedRoles], (req) => ok(learningOf(scopeOf(req)))),

  route('GET', '/api/kirkpatrick/behavior', [scopedRoles], (req) => ok(behaviorOf(scopeOf(req)))),

  route('GET', '/api/kirkpatrick/results', [scopedRoles], (req) => ok(resultsOf(scopeOf(req)))),

  route('GET', '/api/kirkpatrick/chain', [scopedRoles], (req) => ok(chainOf(viewerScope(req)))),

  route('GET', '/api/kirkpatrick/filter-options', [scopedRoles], (req) => {
    const viewer = viewerOf(req)
    // The school administrator (INFERRED) sees only the own school; without a school, none (-1 matches nothing).
    return ok(filterOptionsOf(viewer.role === 'school_admin' ? (viewer.schoolId ?? -1) : null))
  }),
]
