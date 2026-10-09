import type { RouteDef } from '@/mock/define'

import { adminAccessRoutes } from './admin-access'
import { adminQuestionRoutes } from './admin-questions'
import { studentRoutes } from './student'

/** M07-T1a: the student endpoints (#1-#6, #21-#23). M07-T1b: the admin endpoints (#7-#18). */
export const m07Routes: RouteDef[] = [
  ...studentRoutes,
  ...adminQuestionRoutes,
  ...adminAccessRoutes,
]
