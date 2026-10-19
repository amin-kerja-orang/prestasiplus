import type { RouteRecordRaw } from 'vue-router'

import digital from './routes/digital'
import student from './routes/student'

/**
 * M15 routes (F-31 stub, build-plan §S.3 rule 2): only spreads the `routes/<group>.ts` fragments.
 * Each UI task writes its own fragment (M15-T2: `student`, `digital`).
 */
const routes: RouteRecordRaw[] = [...digital, ...student]

export default routes
