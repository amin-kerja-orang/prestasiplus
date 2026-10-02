import type { RouteRecordRaw } from 'vue-router'

import analytics from './routes/analytics'
import commandCenter from './routes/command-center'
import dashboard from './routes/dashboard'
import laporan from './routes/laporan'
import laporanEksekutif from './routes/laporan-eksekutif'
import monitoring from './routes/monitoring'

/**
 * M17 routes (build-plan §S.3 rule 2): only spreads the `routes/<group>.ts` fragments. Each UI task
 * writes its own fragment; M17-T1a created them empty.
 */
const routes: RouteRecordRaw[] = [
  ...analytics,
  ...commandCenter,
  ...dashboard,
  ...laporan,
  ...laporanEksekutif,
  ...monitoring,
]

export default routes
