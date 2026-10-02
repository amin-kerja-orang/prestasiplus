import type { RouteDef } from '@/mock/define'

import { commandCenterDrillRoutes } from './command-center-drill'

/**
 * M17 routes. M17-T1a: SRS §7 #6–#13, the Command Center drill-down (`command-center-drill*.ts`).
 * M17-T1 adds the rest of §7 (#1–#5, #14–#18) here.
 */
export const m17Routes: readonly RouteDef[] = [...commandCenterDrillRoutes]
