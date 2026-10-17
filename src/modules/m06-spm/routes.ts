import type { RouteRecordRaw } from 'vue-router'

import { bijakRoutes } from '@/modules/m28-bijak-spm'

import hub from './routes/hub'
import mockExam from './routes/mock-exam'
import tracking from './routes/tracking'

/**
 * M06 routes (build-plan §S.3 rule 2): only spreads the `routes/<group>.ts` fragments.
 * `hub`: M06-T2 (S1–S4, Q1/Q2, S10). `tracking`: M06-T3 (S5, S6/Q3, S8). `mock-exam`: M06-T4 (S11, Q4, S12, S13).
 * `bijakRoutes`: v2 Bijak SPM student flow (module m28-bijak-spm), mounted under `/spm/bijak`.
 */
const routes: RouteRecordRaw[] = [...hub, ...tracking, ...mockExam, ...bijakRoutes]

export default routes
