/**
 * M01 SRS v1.12 §7 #21 `GET /api/public/stats` (public, M01-T1): the login page numbers
 * (FR-M01-11, BR-21). Computed per request from the M04 and M03 stores (DV-05, D11); M01 stores and
 * hard-codes nothing.
 */

import { ok, route, type RouteDef } from '@/mock/define'

import { platformStats } from './auth-deps'

export const statsRoutes: RouteDef[] = [
  route('GET', '/api/public/stats', () => ok(platformStats())),
]
