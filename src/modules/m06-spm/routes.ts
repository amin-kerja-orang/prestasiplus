import type { RouteRecordRaw } from 'vue-router'

import hub from './routes/hub'
import mockExam from './routes/mock-exam'

/**
 * M06 routes (build-plan §S.3 rule 2): only spreads the `routes/<group>.ts` fragments.
 * `hub`: M06-T2 (S1–S4, Q1/Q2, S10). `mock-exam`: M06-T4 (S11, Q4, S12, S13). T3 is spread here by its task.
 */
const routes: RouteRecordRaw[] = [...hub, ...mockExam]

export default routes
