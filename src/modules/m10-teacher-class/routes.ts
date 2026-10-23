import type { RouteRecordRaw } from 'vue-router'

import commandCenter from './routes/command-center'
import dashboard from './routes/dashboard'
import kelas from './routes/kelas'
import kelasSaya from './routes/kelas-saya'
import pelajar from './routes/pelajar'
import remedialProgress from './routes/remedial-progress'
import setSoalanSaya from './routes/set-soalan-saya'
import soalan from './routes/soalan'

/**
 * M10 routes (build-plan §S.3 rule 2): only spreads the `routes/<group>.ts` fragments. Each UI task
 * writes its own fragment; M10-T1 created them empty.
 */
const routes: RouteRecordRaw[] = [
  ...commandCenter,
  ...dashboard,
  ...kelas,
  ...kelasSaya,
  ...pelajar,
  ...remedialProgress,
  ...setSoalanSaya,
  ...soalan,
]

export default routes
