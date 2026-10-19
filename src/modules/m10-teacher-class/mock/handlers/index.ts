/**
 * The M10-T1 routes (SRS M10 v1.18 §7 #1, #11–#17, #35–#38, #42–#44, #51–#60, #63, #73–#75).
 * #39–#41 are registered by M04 (`handlers/dskp.ts`); the rest belong to the later M10 tasks. M10-T3
 * adds the Command Center #2–#10 (`command-center*.ts`).
 */

import type { RouteDef } from '@/mock/define'

import { classRoutes } from './classes'
import { commandCenterRoutes } from './command-center'
import { dashboardRoutes } from './dashboard'
import { extraRoutes } from './extras'
import { lookupRoutes } from './lookups'
import { questionRoutes } from './questions'
import { studentRoutes } from './students'
import { studentSideRoutes } from './student-side'

export const m10Routes: RouteDef[] = [
  ...dashboardRoutes,
  ...commandCenterRoutes,
  ...classRoutes,
  ...studentRoutes,
  ...lookupRoutes,
  ...questionRoutes,
  ...extraRoutes,
  ...studentSideRoutes,
]
