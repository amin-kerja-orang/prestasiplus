import type { RouteRecordRaw } from 'vue-router'

import adminCurriculum from './routes/admin-curriculum'
import adminSubjectsLevels from './routes/admin-subjects-levels'

/**
 * M03 routes (F-01 stub, build-plan §S.3 rule 2).
 * The module's mock task (T1) creates the `routes/<group>.ts` fragments and spreads them here.
 */
const routes: RouteRecordRaw[] = [...adminCurriculum, ...adminSubjectsLevels]

export default routes
