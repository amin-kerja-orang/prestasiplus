/**
 * SRS M16 v1.6 §7 #22-#41: the games hub, the six room lobbies and rooms, the Papan Bijak quick match,
 * the five single-player games, Roda Nasib, Jutawan Ilmu, the weekly competition and Uji Minda. Logged in
 * (U); a room's endpoints answer 404 to users who are not its players (BR-M16-01). Live-shaped bodies
 * (the quick match, the submits, the spin) use `raw`; the rest use the `{data}` envelope.
 */

import {
  created,
  notFound,
  ok,
  queryString,
  raw,
  requireAuth,
  route,
  str,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'

import { roomGameInfo } from '../data/games'
import { gameResultsRepo, M16Error, roomsRepo } from '../repository'
import type { RoomGame } from '../types'
import { refusal, viewerOf } from './common'

const GAME_404 = 'Permainan tidak dijumpai.'

/** Wraps a handler that may throw `M16Error`: envelope errors. */
function guarded<T>(fn: () => T, field = 'form'): T | MockResponse {
  try {
    return fn()
  } catch (e) {
    return refusal(e, field)
  }
}

const roomGameOf = (v: unknown): RoomGame | null => {
  const info = typeof v === 'string' ? roomGameInfo(v) : undefined
  return info ? info.game : null
}

/** The live-shaped refusal of #33 and #35: `{message}` (and `success: false` for the spin). */
function messageRefusal(e: unknown, spin = false): MockResponse {
  if (!(e instanceof M16Error)) throw e
  const body = spin ? { success: false, message: e.message } : { message: e.message }
  if (e.code === 'CONFLICT') return raw(409, body)
  if (e.code === 'NOT_FOUND') return raw(404, body)
  return raw(422, body)
}

export const gamesRoutes: RouteDef[] = [
  // #22
  route('GET', '/api/games/hub', [requireAuth()], (req) => ok(roomsRepo.hub(viewerOf(req).id))),

  // #34, #35
  route('GET', '/api/games/roda-nasib', [requireAuth()], (req) =>
    ok(gameResultsRepo.spinPage(viewerOf(req).id)),
  ),
  route('POST', '/api/games/roda-nasib/spin', [requireAuth()], (req, ctx) => {
    try {
      const result = gameResultsRepo.spin(viewerOf(req).id, ctx.prng)
      const { coinsCredited, ...rest } = result
      return raw(200, { success: true, message: '', result: rest, coinsCredited })
    } catch (e) {
      return messageRefusal(e, true)
    }
  }),

  // #36–#39 Jutawan Ilmu
  route('GET', '/api/games/jutawan', [requireAuth()], (req) =>
    guarded(() =>
      ok(gameResultsRepo.jutawanPage(viewerOf(req).id, queryString(req.query, 'darjah'))),
    ),
  ),
  route('POST', '/api/games/jutawan/start', [requireAuth()], (req, ctx) =>
    guarded(() => ok(gameResultsRepo.jutawanStart(viewerOf(req).id, req.body, ctx.prng))),
  ),
  route(
    'POST',
    '/api/games/jutawan/:sessionId/answer',
    [requireAuth()],
    (req) =>
      guarded(() =>
        ok(
          gameResultsRepo.jutawanAnswer(viewerOf(req).id, req.params.sessionId as string, req.body),
        ),
      ),
    { params: { sessionId: str() } },
  ),
  route(
    'POST',
    '/api/games/jutawan/:sessionId/lifeline',
    [requireAuth()],
    (req, ctx) =>
      guarded(() =>
        ok(
          gameResultsRepo.jutawanLifeline(
            viewerOf(req).id,
            req.params.sessionId as string,
            req.body,
            ctx.prng,
          ),
        ),
      ),
    { params: { sessionId: str() } },
  ),

  // #40, #41
  route('GET', '/api/games/pertandingan', [requireAuth()], (req) =>
    ok(gameResultsRepo.weekly(viewerOf(req).id)),
  ),
  route('GET', '/api/games/uji-minda', [requireAuth()], () => ok({ challenge: null })),

  // #32, #33 single-player games
  route(
    'GET',
    '/api/games/solo/:game',
    [requireAuth()],
    (req, ctx) =>
      guarded(() =>
        ok(
          gameResultsRepo.solo(
            viewerOf(req).id,
            req.params.game as string,
            queryString(req.query, 'darjah'),
            ctx.prng,
          ),
        ),
      ),
    { params: { game: str() } },
  ),
  route(
    'POST',
    '/api/games/solo/:game/submit',
    [requireAuth()],
    (req) => {
      try {
        return raw(
          200,
          gameResultsRepo.submit(viewerOf(req).id, req.params.game as string, req.body),
        )
      } catch (e) {
        return messageRefusal(e)
      }
    },
    { params: { game: str() } },
  ),

  // #29–#31 Papan Bijak quick match
  route('POST', '/api/papan-bijak/quick-match', [requireAuth()], (req) => {
    try {
      return raw(200, roomsRepo.pbStart(viewerOf(req).id, req.body))
    } catch (e) {
      if (e instanceof M16Error) return raw(422, { error: e.message })
      throw e
    }
  }),
  route('GET', '/api/papan-bijak/quick-match/poll', [requireAuth()], (req, ctx) =>
    raw(200, roomsRepo.pbPoll(viewerOf(req).id, ctx.prng)),
  ),
  route('POST', '/api/papan-bijak/quick-match/cancel', [requireAuth()], (req) =>
    raw(200, roomsRepo.pbCancel(viewerOf(req).id)),
  ),

  // #23 lobby
  route(
    'GET',
    '/api/games/:game/lobby',
    [requireAuth()],
    (req) => {
      const game = roomGameOf(req.params.game)
      if (!game) return notFound(GAME_404)
      return guarded(() => ok(roomsRepo.lobby(viewerOf(req).id, game)))
    },
    { params: { game: str() } },
  ),

  // #24 create, #25 join
  route(
    'POST',
    '/api/games/:game/rooms',
    [requireAuth()],
    (req, ctx) => {
      const game = roomGameOf(req.params.game)
      if (!game) return notFound(GAME_404)
      return guarded(() => created(roomsRepo.create(viewerOf(req).id, game, req.body, ctx.prng)))
    },
    { params: { game: str() } },
  ),
  route(
    'POST',
    '/api/games/:game/rooms/join',
    [requireAuth()],
    (req) => {
      const game = roomGameOf(req.params.game)
      if (!game) return notFound(GAME_404)
      const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<
        string,
        unknown
      >
      return guarded(() => ok(roomsRepo.join(viewerOf(req).id, game, body.room_code)))
    },
    { params: { game: str() } },
  ),

  // #26 room, #27 start, #28 action
  route(
    'GET',
    '/api/games/:game/rooms/:code',
    [requireAuth()],
    (req, ctx) => {
      const game = roomGameOf(req.params.game)
      if (!game) return notFound(GAME_404)
      return guarded(() =>
        ok(roomsRepo.view(viewerOf(req).id, game, req.params.code as string, ctx.prng)),
      )
    },
    { params: { game: str(), code: str() } },
  ),
  route(
    'POST',
    '/api/games/:game/rooms/:code/start',
    [requireAuth()],
    (req, ctx) => {
      const game = roomGameOf(req.params.game)
      if (!game) return notFound(GAME_404)
      return guarded(() =>
        ok(roomsRepo.start(viewerOf(req).id, game, req.params.code as string, ctx.prng)),
      )
    },
    { params: { game: str(), code: str() } },
  ),
  route(
    'POST',
    '/api/games/:game/rooms/:code/action',
    [requireAuth()],
    (req, ctx) => {
      const game = roomGameOf(req.params.game)
      if (!game) return notFound(GAME_404)
      return guarded(() =>
        ok(roomsRepo.action(viewerOf(req).id, game, req.params.code as string, req.body, ctx.prng)),
      )
    },
    { params: { game: str(), code: str() } },
  ),
]
