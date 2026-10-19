import type { RouteDef } from '@/mock/define'

import { classRoutes } from './class'
import { headcountRoutes } from './headcount'
import { itemAnalysisRoutes } from './item-analysis'
import { performanceRoutes } from './performance'
import { socialRoutes } from './social'
import { studentRoutes } from './student'

/**
 * M08-T1 routes: §7 #1–#4, #6, #7, #9–#11, #18–#23; M08-T1b adds the headcount routes #12–#17, #24–#29;
 * M08-T7 adds #5 (class dashboard) and #8 (class analytics) in `class.ts`.
 */
export const m08Routes: readonly RouteDef[] = [
  ...performanceRoutes,
  ...classRoutes,
  ...studentRoutes,
  ...itemAnalysisRoutes,
  ...socialRoutes,
  ...headcountRoutes,
]
