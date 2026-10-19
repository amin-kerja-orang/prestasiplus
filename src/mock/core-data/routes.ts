/**
 * Core endpoints (overview §7, §10 "Shell data contracts"):
 *
 * | Endpoint | Contract | Status |
 * |---|---|---|
 * | `GET /api/me` | M01 #7: 200 `{data: UserMe}`; 401 | final (implemented in the core, not M01) |
 * | `GET /api/me/gamification-summary` | 200 `{data: {coins, points, streakDays}}`; 401 | M14 #1: read from the M14 `wallet` and `streak` repositories (F-26b) |
 *
 * `GET /api/admin/server-status`: F-18 (build-plan v1.11), `./server-status.ts`.
 */

import { streak, wallet } from '@/modules/m14-gamification/mock'

import { requireAuth } from '../auth/middleware'
import { API_ERROR_CODES } from '@/api/errors'
import { DEFAULT_ERROR_MESSAGES, fail, ok } from '../server/respond'
import { route } from '../server/router'
import type { MockRequest } from '../server/types'
import { toUserMe } from './me'
import { serverStatusRoute } from './server-status'
import { isSessionUser, users } from './users'

/** `GET /api/me/gamification-summary` data (overview §10). */
export interface GamificationSummary {
  coins: number
  points: number
  streakDays: number
}

/** XL-27 defaults: a user without a wallet/streak row reads 0 / 0 / 0. */
export const EMPTY_GAMIFICATION: Readonly<GamificationSummary> = Object.freeze({
  coins: 0,
  points: 0,
  streakDays: 0,
})

/**
 * M14 #1 (F-26b; SRS M14 §7 #1, FR-M14-10): `coins` = `wallet.summary.currentSyiling`, `points` =
 * `xp`, `streakDays` = `streak.get.current`, read from the M14 repositories at call time (users
 * without a row read the BR-M14-02 defaults, 0 / 0 / 0). When the M14 stores are not booted in
 * this runtime (a boot without the M14 plugin), the XL-27 defaults are returned.
 */
export function gamificationSummaryOf(userId: number): GamificationSummary {
  if (!wallet.ready()) return { ...EMPTY_GAMIFICATION }
  const summary = wallet.summary(userId)
  return {
    coins: summary.currentSyiling,
    points: summary.xp,
    streakDays: streak.get(userId).current,
  }
}

function sessionUserId(req: MockRequest): number {
  if (!req.session) throw new Error('requireAuth() must run first')
  return req.session.userId
}

const unauthenticated = () =>
  fail(401, API_ERROR_CODES.UNAUTHORIZED, DEFAULT_ERROR_MESSAGES.UNAUTHORIZED)

export const coreRoutes = [
  route('GET', '/api/me', [requireAuth()], (req) => {
    const user = users.get(sessionUserId(req))
    return user && isSessionUser(user) ? ok(toUserMe(user)) : unauthenticated()
  }),
  route('GET', '/api/me/gamification-summary', [requireAuth()], (req) =>
    ok(gamificationSummaryOf(sessionUserId(req))),
  ),
  serverStatusRoute,
]
