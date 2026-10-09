import type { RouteRecordRaw } from 'vue-router'

import admin from './routes/admin'
import student from './routes/student'

/**
 * M07 routes (build-plan §S.3 rule 2): only spreads the `routes/<group>.ts` fragments.
 * `student` (M07-T2: S1-S4, S4a, S4b) and `admin` (M07-T3 / M07-T4: S5-S8).
 */
const routes: RouteRecordRaw[] = [...student, ...admin]

export default routes
