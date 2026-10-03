/**
 * SRS M16 v1.6 §7 #51-#52: the game settings page data (S29) and the `boardgame_quiz_tiles` save. Admin
 * only (BR-M16-01): 401 without a session, 403 for any other role.
 */

import { ok, requireRole, route, type RouteDef } from '@/mock/define'

import { roomsRepo } from '../repository'
import { refusal } from './common'

export const adminGamesRoutes: RouteDef[] = [
  // #51
  route('GET', '/api/admin/games', [requireRole('admin')], () => ok(roomsRepo.adminOverview())),

  // #52
  route('PUT', '/api/admin/games/settings', [requireRole('admin')], (req) => {
    try {
      const b = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<
        string,
        unknown
      >
      return ok(roomsRepo.setQuizTiles(b.boardgame_quiz_tiles))
    } catch (e) {
      return refusal(e, 'boardgame_quiz_tiles')
    }
  }),
]
