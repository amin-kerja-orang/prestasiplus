import type { RouteDef } from '@/mock/define'

import { monitoringRoutes } from './monitoring'
import { reportRoutes } from './report'

/** M11-T1 routes: SRS M11 §7 #1, #3–#8 (#2 is M10 #12, #9 is M03 #28). */
export const m11Routes: readonly RouteDef[] = [...reportRoutes, ...monitoringRoutes]
