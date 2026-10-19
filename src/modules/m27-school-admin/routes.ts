import type { RouteRecordRaw } from 'vue-router'

import aktiviti from './routes/aktiviti'
import amaran from './routes/amaran'
import bulanan from './routes/bulanan'
import dashboard from './routes/dashboard'
import dskp from './routes/dskp'
import guru from './routes/guru'
import kelas from './routes/kelas'
import pelajar from './routes/pelajar'
import statistik from './routes/statistik'

/**
 * M27 routes (build-plan §S.3 rule 2): only spreads the `routes/<group>.ts` fragments. Each screen's
 * task writes its own fragment and adds one spread line here.
 */
const routes: RouteRecordRaw[] = [
  ...dashboard,
  ...statistik,
  ...dskp,
  ...bulanan,
  ...kelas,
  ...pelajar,
  ...guru,
  ...aktiviti,
  ...amaran,
]

export default routes
