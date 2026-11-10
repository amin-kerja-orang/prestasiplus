/**
 * SRS M16 v1.6 §7 #46-#49: the leagues (S25-S27), logged in (U). R1: create and school enrolment are Admin Pusat
 * only (API-ADM-25), join is closed (403, API-GAME-05). API-GAME-13: `standings` and `me`, pupils (role M) only. API-AS-14: the live Sekolah Bersaing board, school admin and admin only.
 */

import {
  created,
  forbidden,
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

  // #47 (API-ADM-25, Admin Pusat only): answers the league detail.
  route('POST', '/api/leagues', [requireRole('admin')], (req, ctx) => {
    try {
      const league = leaguesRepo.create(parseLeagueBody(req.body), viewerOf(req).id, ctx.prng)
      return created(leaguesRepo.get(league.id))
    } catch (e) {
      return refusal(e)
    }
  }),

  // #48: closed in R1 (AC-GM-15.2); Admin Pusat enrols schools instead.
  route('POST', '/api/leagues/join', [requireAuth()], () => forbidden()),

  // API-ADM-25 `POST /api/leagues/:id/schools`: Admin Pusat enrols schools, all or nothing.
  route(
    'POST',
    '/api/leagues/:id/schools',
    [requireRole('admin')],
    (req) => {
      try {
        const b = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<string, unknown>
        leaguesRepo.enrol(req.params.id as number, b.schoolIds)
        return ok(leaguesRepo.get(req.params.id as number))
      } catch (e) {
        return refusal(e, 'schoolIds')
      }
    },
    { params: { id: int() } },
  ),

  // #49
  route(
    'GET',
    '/api/leagues/:id',
    [requireAuth()],
    (req) => {
      const detail = leaguesRepo.get(req.params.id as number)
      return detail ? ok(detail) : notFound('Liga tidak dijumpai.')
    },
    { params: { id: int() } },
  ),

  // API-GAME-13: the stored standings of one Tingkatan (`?level=` 1..5, default the lowest level). Role M only.
  route(
    'GET',
    '/api/leagues/:id/standings',
    [requireRole('student')],
    (req) => {
      try {
        const view = leaguesRepo.standingsOf(req.params.id as number, Array.isArray(req.query.level) ? req.query.level[0] : req.query.level)
        return view ? ok(view) : notFound('Liga tidak dijumpai.')
      } catch (e) {
        return refusal(e, 'level')
      }
    },
    { params: { id: int() } },
  ),

  // API-GAME-13: the pupil's school position, own points and top contributors. Role M only.
  route(
    'GET',
    '/api/leagues/:id/me',
    [requireRole('student')],
    (req) => {
      const viewer = viewerOf(req)
      const view = leaguesRepo.meOf(req.params.id as number, viewer.schoolId, viewer.grade)
      return view ? ok(view) : notFound('Liga tidak dijumpai.')
    },
    { params: { id: int() } },
  ),

  // API-AS-14 (OQ-API-09): reads no query parameter, so an unknown one is ignored (FR-AS-45-3).
  route('GET', '/api/sekolah-bersaing', [requireRole('school_admin', 'admin')], () =>
    ok(sekolahBersaingRepo.view()),
  ),
]
