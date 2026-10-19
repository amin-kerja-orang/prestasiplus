import type { RouteDef } from '@/mock/define'

import { commandCenterDailyRoutes } from './command-center-daily'
import { commandCenterDrillRoutes } from './command-center-drill'
import { commandCenterLiveRoutes } from './command-center-live'

/**
 * M17 routes. M17-T1a: SRS §7 #6–#13, the Command Center drill-down (`command-center-drill*.ts`).
 * M17-T1b: §7 #3 live-data (`command-center-live*.ts`), #4 daily-activity and #5 its school drill
 * (`command-center-daily*.ts`). M17-T1 adds the rest of §7 (#1, #2, #14–#18) here.
 */
export const m17Routes: readonly RouteDef[] = [
  ...commandCenterLiveRoutes,
  ...commandCenterDailyRoutes,
  ...commandCenterDrillRoutes,
]
