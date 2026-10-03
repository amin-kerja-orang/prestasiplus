import type { RouteRecordRaw } from 'vue-router'

import mockExam from './routes/mock-exam'

/**
 * M06 routes (F-01 stub, build-plan §S.3 rule 2): only spreads the `routes/<group>.ts` fragments.
 * `mock-exam` (M06-T4: S11, Q4, S12, S13).
 */
const routes: RouteRecordRaw[] = [...mockExam]

export default routes
