import type { RouteRecordRaw } from 'vue-router'

import behavior from './routes/behavior'
import chain from './routes/chain'
import interventions from './routes/interventions'
import learning from './routes/learning'
import overview from './routes/overview'
import pelajar from './routes/pelajar'
import reaction from './routes/reaction'
import results from './routes/results'
import student from './routes/student'

/**
 * M12 routes (build-plan §S.3 rule 2): only spreads the `routes/<group>.ts` fragments. Each UI task writes its
 * own fragment; M12-T1 created them empty.
 */
const routes: RouteRecordRaw[] = [
  ...overview,
  ...reaction,
  ...learning,
  ...behavior,
  ...results,
  ...chain,
  ...interventions,
  ...pelajar,
  ...student,
]

export default routes
