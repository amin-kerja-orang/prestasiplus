/**
 * The M14-T1 routes (SRS M14 v1.8 §7 #2–#43). #1 `GET /api/me/gamification-summary` stays the core
 * handler (overview §10); the cabutan list of M15 (`GET /api/cabutan`) and M15 #9–#11 call the
 * `draws` / `wallet` repositories, not these routes.
 */

import type { RouteDef } from '@/mock/define'

import { adminEconomyRoutes } from './admin-economy'
import { adminOpsRoutes } from './admin-ops'
import { studentRoutes } from './student'
import { teacherRoutes } from './teacher'

export const m14Routes: RouteDef[] = [
  ...studentRoutes,
  ...teacherRoutes,
  ...adminEconomyRoutes,
  ...adminOpsRoutes,
]
