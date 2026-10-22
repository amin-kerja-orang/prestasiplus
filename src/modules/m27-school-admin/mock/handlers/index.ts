import type { RouteDef } from '@/mock/define'

import { activityRoutes } from './activity'
import { classRoutes } from './classes'
import { dashboardRoutes } from './dashboard'
import { dskpHeatmapRoutes } from './dskp-heatmap'
import { impersonateRoutes } from './impersonate'
import { monthlyRoutes } from './monthly'
import { pendingTeacherRoutes } from './pending-teachers'
import { usageRoutes } from './usage'
import { userReadRoutes } from './users-read'
import { userWriteRoutes } from './users-write'

/** M27 routes (SRS M27 §7, Part B §19). A later screen adds its `<group>Routes` here. */
export const m27Routes: readonly RouteDef[] = [
  ...dashboardRoutes,
  ...usageRoutes,
  ...activityRoutes,
  ...dskpHeatmapRoutes,
  ...monthlyRoutes,
  ...pendingTeacherRoutes,
  ...userReadRoutes,
  ...userWriteRoutes,
  ...classRoutes,
  ...impersonateRoutes,
]
