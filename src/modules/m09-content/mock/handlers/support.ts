/**
 * SRS M09 v1.5 §7 #20 `GET /api/banners/active` (logged in; BR-M09-14, the M05 carousel input) and
 * #43 `GET /api/config/support` (public; the panduan help box, DV-M09-14).
 */

import { ok, requireAuth, route, unpaged, type RouteDef } from '@/mock/define'

import { bannersRepo, supportRepo } from '../repository'
import { requireViewer } from './common'

export const supportRoutes: RouteDef[] = [
  route('GET', '/api/banners/active', [requireAuth()], (req) =>
    unpaged(bannersRepo.activeFor({ role: requireViewer(req).role })),
  ),

  route('GET', '/api/config/support', () => ok(supportRepo.config())),
]
