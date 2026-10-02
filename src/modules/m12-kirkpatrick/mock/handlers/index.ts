/**
 * M12 routes (SRS M12 v1.6 §7 #1-#14): #1-#6 and #14 (`levels.ts`), #7 (`export.ts`), #8-#9
 * (`interventions.ts`), #10-#11 (`students.ts`) and #12-#13 (`feedback.ts`).
 */

import type { RouteDef } from '@/mock/define'

import { exportRoutes } from './export'
import { feedbackRoutes } from './feedback'
import { interventionRoutes } from './interventions'
import { levelRoutes } from './levels'
import { studentRoutes } from './students'

export const m12Routes: RouteDef[] = [
  ...levelRoutes,
  ...exportRoutes,
  ...interventionRoutes,
  ...studentRoutes,
  ...feedbackRoutes,
]
