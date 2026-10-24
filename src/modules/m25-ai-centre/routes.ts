import type { RouteRecordRaw } from 'vue-router'

import heatmap from './routes/heatmap'

/**
 * M25 routes (F-31b stub, build-plan §S.3 rule 2). M25-T2 spreads `routes/heatmap.ts` (S1 Peta Haba Topik Lemah).
 */
const routes: RouteRecordRaw[] = [...heatmap]

export default routes
