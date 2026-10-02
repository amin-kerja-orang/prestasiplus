import type { RouteRecordRaw } from 'vue-router'

import analisaItem from './routes/analisa-item'
import analitik from './routes/analitik'
import classRoutes from './routes/class'
import headcount from './routes/headcount'
import prestasi from './routes/prestasi'
import ranking from './routes/ranking'
import timeline from './routes/timeline'

/**
 * M08 routes (build-plan §S.3 rule 2): only spreads the `routes/<group>.ts` fragments. M08-T1 created
 * them empty; each UI task writes its own fragment:
 * `analitik` (M08-T2: S7, S6), `timeline` (M08-T3: S16–S18), `ranking` (M08-T4: S19, S20),
 * `prestasi` (M08-T5: S1–S3, S4, S21), `analisa-item` (M08-T5: S9, redirect, S10/S11 403),
 * `headcount` (M08-T6: S12–S15, S22, S23), `class` (M08-T7: S4, S5, S8, S10, S11 teacher variants).
 */
const routes: RouteRecordRaw[] = [
  ...prestasi,
  ...analitik,
  ...analisaItem,
  ...headcount,
  ...classRoutes,
  ...timeline,
  ...ranking,
]

export default routes
