/**
 * SRS M16 v1.6 §7 #2-#17: the live `/api/battle/*` endpoints (bodies as on live, SRS §7 conventions) and the
 * provisional arena (#16, #17: envelope `{data}`). Logged in (U); the arena answers 404 to users who are
 * not players of the battle (BR-M16-01). The polling contract of §7.1 is the client's; every opponent is a
 * SIMULATION (D4).
 */

import { int, ok, raw, requireAuth, route, str, queryString, type RouteDef } from '@/mock/define'

import { battlesRepo, parseBattleParams } from '../repository'
import { liveRefusal, refusal, startRefusal, viewerOf } from './common'

function start(mode: 'quick_match' | 'school_battle'): RouteDef {
  const path = mode === 'quick_match' ? '/api/battle/quick-match' : '/api/battle/school-battle'
  return route('POST', path, [requireAuth()], (req, ctx) => {
    try {
      const viewer = viewerOf(req)
      const params = parseBattleParams(req.body, viewer)
      return raw(200, { queue_id: battlesRepo.start(viewer.id, mode, params, ctx.prng) })
    } catch (e) {
      return startRefusal(e)
    }
  })
}

export const battleRoutes: RouteDef[] = [
  start('quick_match'),
  start('school_battle'),

  // #4
  route(
    'GET',
    '/api/battle/poll-match/:queueId',
    [requireAuth()],
    (req, ctx) => {
      try {
        const r = battlesRepo.pollMatch(viewerOf(req).id, req.params.queueId as number, ctx.prng)
        if (r.status === 'error') return raw(r.httpStatus, { error: 'Ralat pelayan.' })
        return raw(200, r)
      } catch (e) {
        return liveRefusal(e)
      }
    },
    { params: { queueId: int() } },
  ),

  // #5
  route(
    'POST',
    '/api/battle/accept-challenger/:queueId',
    [requireAuth()],
    (req, ctx) => {
      try {
        const uuid = battlesRepo.acceptChallenger(
          viewerOf(req).id,
          req.params.queueId as number,
          ctx.prng,
        )
        return raw(200, { matched: true, battle_uuid: uuid })
      } catch (e) {
        return liveRefusal(e)
      }
    },
    { params: { queueId: int() } },
  ),

  // #6
  route(
    'POST',
    '/api/battle/reject-challenger/:queueId',
    [requireAuth()],
    (req) => {
      try {
        battlesRepo.rejectChallenger(viewerOf(req).id, req.params.queueId as number)
        return raw(200, { success: true })
      } catch (e) {
        return liveRefusal(e)
      }
    },
    { params: { queueId: int() } },
  ),

  // #7
  route('GET', '/api/battle/search-opponent', [requireAuth()], (req) =>
    raw(200, {
      users: battlesRepo.searchOpponent(viewerOf(req).id, queryString(req.query, 'q') ?? ''),
    }),
  ),

  // #8
  route('POST', '/api/battle/invite', [requireAuth()], (req, ctx) => {
    try {
      const viewer = viewerOf(req)
      const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<
        string,
        unknown
      >
      const params = parseBattleParams(body, viewer)
      battlesRepo.invite(viewer.id, body.receiver_id, params, ctx.prng)
      return raw(200, { success: true })
    } catch (e) {
      return liveRefusal(e)
    }
  }),

  // #9
  route('GET', '/api/battle/invitations', [requireAuth()], (req) =>
    raw(200, { invitations: battlesRepo.invitations(viewerOf(req).id) }),
  ),

  // #10
  route(
    'POST',
    '/api/battle/invite/:uuid/accept',
    [requireAuth()],
    (req, ctx) => {
      try {
        const uuid = battlesRepo.acceptInvitation(
          viewerOf(req).id,
          req.params.uuid as string,
          ctx.prng,
        )
        return raw(200, { success: true, battle_uuid: uuid })
      } catch (e) {
        return liveRefusal(e)
      }
    },
    { params: { uuid: str() } },
  ),

  // #11
  route(
    'POST',
    '/api/battle/invite/:uuid/decline',
    [requireAuth()],
    (req) => {
      try {
        battlesRepo.declineInvitation(viewerOf(req).id, req.params.uuid as string)
        return raw(200, { success: true })
      } catch (e) {
        return liveRefusal(e)
      }
    },
    { params: { uuid: str() } },
  ),

  // #12
  route(
    'POST',
    '/api/battle/join-queue/:queueId',
    [requireAuth()],
    (req) => {
      try {
        battlesRepo.joinQueue(viewerOf(req).id, req.params.queueId as number)
        return raw(200, { success: true })
      } catch (e) {
        return liveRefusal(e)
      }
    },
    { params: { queueId: int() } },
  ),

  // #13
  route(
    'GET',
    '/api/battle/poll-challenger/:queueId',
    [requireAuth()],
    (req, ctx) =>
      raw(
        200,
        battlesRepo.pollChallenger(viewerOf(req).id, req.params.queueId as number, ctx.prng),
      ),
    { params: { queueId: int() } },
  ),

  // #14
  route(
    'POST',
    '/api/battle/forfeit/:uuid',
    [requireAuth()],
    (req) => {
      try {
        battlesRepo.forfeit(viewerOf(req).id, req.params.uuid as string)
        return raw(200, { success: true })
      } catch (e) {
        return liveRefusal(e)
      }
    },
    { params: { uuid: str() } },
  ),

  // #15
  route('GET', '/api/battle/lobby', [requireAuth()], (req) =>
    ok(battlesRepo.lobby(viewerOf(req).id)),
  ),

  // #16
  route(
    'GET',
    '/api/battle/arena/:uuid',
    [requireAuth()],
    (req) => {
      try {
        return ok(battlesRepo.arena(viewerOf(req).id, req.params.uuid as string))
      } catch (e) {
        return refusal(e)
      }
    },
    { params: { uuid: str() } },
  ),

  // #17
  route(
    'POST',
    '/api/battle/arena/:uuid/answer',
    [requireAuth()],
    (req, ctx) => {
      try {
        const b = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<
          string,
          unknown
        >
        return ok(
          battlesRepo.answer(
            viewerOf(req).id,
            req.params.uuid as string,
            { questionId: b.questionId, optionId: b.optionId ?? null, seconds: b.seconds },
            ctx.prng,
          ),
        )
      } catch (e) {
        return refusal(e)
      }
    },
    { params: { uuid: str() } },
  ),
]
