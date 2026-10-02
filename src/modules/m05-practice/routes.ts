import type { RouteRecordRaw } from 'vue-router'

import chapter from './routes/chapter'
import dashboard from './routes/dashboard'
import practice from './routes/practice'
import progress from './routes/progress'
import remedial from './routes/remedial'
import structured from './routes/structured'

/**
 * M05 routes (build-plan §S.3 rule 2): only spreads the `routes/<group>.ts` fragments. Each UI task
 * writes its own fragment; M05-T1 created them empty.
 */
const routes: RouteRecordRaw[] = [
  ...dashboard,
  ...practice,
  ...chapter,
  ...progress,
  ...remedial,
  ...structured,
]

export default routes
