import type { RouteRecordRaw } from 'vue-router'

import admin from './routes/admin'
import digital from './routes/digital'
import student from './routes/student'

/**
 * M15 routes (F-31 stub, build-plan §S.3 rule 2): only spreads the `routes/<group>.ts` fragments.
 * Each UI task writes its own fragment (M15-T2: `student`, `digital`; S7-T11: `admin`).
 */
const routes: RouteRecordRaw[] = [...admin, ...digital, ...student]

export default routes
