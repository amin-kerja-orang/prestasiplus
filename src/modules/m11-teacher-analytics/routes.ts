import type { RouteRecordRaw } from 'vue-router'

import analisisItem from './routes/analisis-item'
import laporan from './routes/laporan'
import laporanMingguan from './routes/laporan-mingguan'
import monitoring from './routes/monitoring'
import perbandinganKelas from './routes/perbandingan-kelas'

/**
 * M11 routes (build-plan §S.3 rule 2): only spreads the `routes/<group>.ts` fragments. Each UI task
 * writes its own fragment; M11-T1 created them empty.
 */
const routes: RouteRecordRaw[] = [
  ...analisisItem,
  ...laporan,
  ...laporanMingguan,
  ...monitoring,
  ...perbandinganKelas,
]

export default routes
