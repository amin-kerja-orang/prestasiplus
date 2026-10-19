import type { RouteRecordRaw } from 'vue-router'

import studentA from './routes/student-a'
import studentB from './routes/student-b'

/**
 * M14 routes (F-31 stub, build-plan §S.3 rule 2).
 * The module's mock task (T1) creates the `routes/<group>.ts` fragments and spreads them here.
 */
const routes: RouteRecordRaw[] = [...studentA, ...studentB]

export default routes
