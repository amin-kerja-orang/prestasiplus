import type { RouteRecordRaw } from 'vue-router'

import hub from './routes/hub'

/**
 * M06 routes (build-plan §S.3 rule 2): only spreads the `routes/<group>.ts` fragments.
 * `hub`: M06-T2 (S1–S4, Q1/Q2, S10). The T3 and T4 fragments are spread here by their tasks.
 */
const routes: RouteRecordRaw[] = [...hub]

export default routes
