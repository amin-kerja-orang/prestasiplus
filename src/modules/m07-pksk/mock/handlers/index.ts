import type { RouteDef } from '@/mock/define'

import { studentRoutes } from './student'

/** M07-T1a: the student endpoints. The admin endpoints (#7-#18) are M07-T1b. */
export const m07Routes: RouteDef[] = [...studentRoutes]
