import type { RouteRecordRaw } from 'vue-router'

import student from './routes/student'

/**
 * M07 routes (build-plan §S.3 rule 2): only spreads the `routes/<group>.ts` fragments.
 * `student` (M07-T2: S1-S4, S4a, S4b). The admin fragments come with M07-T3 / T4 (deferred).
 */
const routes: RouteRecordRaw[] = [...student]

export default routes
