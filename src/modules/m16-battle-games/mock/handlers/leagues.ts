/**
 * SRS M16 v1.6 §7 #46-#49: the leagues (S25-S27), logged in (U); the league invite code is visible to
 * non-members, as live. API-AS-14: the live Sekolah Bersaing board, school admin and admin only.
 */

import {
  created,
  int,
  notFound,
  ok,
  requireAuth,
  requireRole,
  route,
  type RouteDef,
} from '@/mock/define'

import { leaguesRepo, parseLeagueBody, sekolahBersaingRepo } from '../repository'
import { refusal, viewerOf } from './common'

export const leagueRoutes: RouteDef[] = [
  // #46
  route('GET', '/api/leagues', [requireAuth()], (req) =>
    ok(leaguesRepo.list(viewerOf(req).schoolId)),
  ),

  // #47
  route('POST', '/api/leagues', [requireAuth()], (req, ctx) => {
    try {
      const league = leaguesRepo.create(parseLeagueBody(req.body), viewerOf(req).id, ctx.prng)
      return created({ id: league.id })
    } catch (e) {
      return refusal(e)
    }
  }),

  // #48
  route('POST', '/api/leagues/join', [requireAuth()], (req) => {
    try {
      const b = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<
        string,
        unknown
      >
      return ok({ id: leaguesRepo.join(b.invite_code, viewerOf(req).id) })
    } catch (e) {
      return refusal(e, 'invite_code')
    }
  }),

  // #49
  route(
    'GET',
    '/api/leagues/:id',
    [requireAuth()],
    (req) => {
      const detail = leaguesRepo.get(req.params.id as number, viewerOf(req).schoolId)
      return detail ? ok(detail) : notFound('Liga tidak dijumpai.')
    },
    { params: { id: int() } },
  ),

  // API-AS-14 (OQ-API-09): reads no query parameter, so an unknown one is ignored (FR-AS-45-3).
  route('GET', '/api/sekolah-bersaing', [requireRole('school_admin', 'admin')], () =>
    ok(sekolahBersaingRepo.view()),
  ),
]
