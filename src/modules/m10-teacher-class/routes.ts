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
 * R1-GUR-2b Misi Harian (S6-T07): teacher only in both API modes (API-GUR-11 is teacher-only and the
 * mock has no handler), so it is not part of the `routes/dashboard.ts` fragment, whose roles follow the
 * mock-mode rule of `routes/roles.ts`. `/cipta` redirects to the list with the form open (D115).
 */
const misiHarian: RouteRecordRaw[] = [
  {
    path: '/guru/misi-harian',
    name: 'm10.guru-misi-harian',
    component: () => import('./pages/MisiHarianPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['teacher'],
      title: 'Misi Harian — PRESTASIPLUS',
      header: { title: 'Misi Harian', subtitle: 'Assign misi harian kepada pelajar' },
      module: 'M10',
      v2: true,
    },
  },
  { path: '/guru/misi-harian/cipta', redirect: '/guru/misi-harian?baru=1' },
]

/**
 * M10 routes (build-plan §S.3 rule 2): only spreads the `routes/<group>.ts` fragments. Each UI task
 * writes its own fragment; M10-T1 created them empty.
 */
const routes: RouteRecordRaw[] = [
  ...commandCenter,
  ...dashboard,
  ...misiHarian,
  ...kelas,
  ...kelasSaya,
  ...pelajar,
  ...remedialProgress,
  ...setSoalanSaya,
  ...soalan,
]

export default routes
