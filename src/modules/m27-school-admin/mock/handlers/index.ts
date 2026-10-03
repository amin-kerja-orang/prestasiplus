import type { RouteDef } from '@/mock/define'

import { dashboardRoutes } from './dashboard'

/** M27 routes (SRS M27 §7). A later screen adds its `<group>Routes` here. */
export const m27Routes: readonly RouteDef[] = [...dashboardRoutes]
