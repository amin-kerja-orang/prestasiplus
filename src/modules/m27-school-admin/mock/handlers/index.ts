import type { RouteDef } from '@/mock/define'

import { classRoutes } from './classes'
import { dashboardRoutes } from './dashboard'
import { dskpHeatmapRoutes } from './dskp-heatmap'
import { monthlyRoutes } from './monthly'
import { usageRoutes } from './usage'
import { userReadRoutes } from './users-read'

/** M27 routes (SRS M27 §7, Part B §19). A later screen adds its `<group>Routes` here. */
export const m27Routes: readonly RouteDef[] = [
  ...dashboardRoutes,
  ...usageRoutes,
  ...dskpHeatmapRoutes,
  ...monthlyRoutes,
  ...userReadRoutes,
  ...classRoutes,
]
