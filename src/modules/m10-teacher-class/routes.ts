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
 * R1-GUR-8b teacher Set Soalan (S6-T14): teacher only in both API modes (API-GUR-16 is teacher-only and
 * has no mock handler), so it is not part of a fragment whose roles follow `routes/roles.ts`. There is
 * no sidebar item: the Dashboard tile "Set Soalan" (`Urus set →`) is the entry. The V2 path
 * `/guru/set/cipta` is not a second page: it redirects (replace) to `/guru/set-soalan/cipta`.
 */
const setSoalanGuru: RouteRecordRaw[] = [
  {
    path: '/guru/set-soalan',
    name: 'm10.guru-set-soalan',
    component: () => import('./pages/SetSoalanGuruListPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['teacher'],
      title: 'Set Soalan Guru — PRESTASIPLUS',
      header: { title: 'Set Soalan Anda', subtitle: 'Cipta set soalan dan kongsi dengan kelas anda' },
      module: 'M10',
      v2: true,
    },
  },
  {
    path: '/guru/set-soalan/cipta',
    name: 'm10.guru-set-soalan-cipta',
    component: () => import('./pages/SetSoalanGuruFormPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['teacher'],
      title: 'Cipta Set Soalan — PRESTASIPLUS',
      header: { title: 'Cipta Set Soalan', subtitle: 'Bina set daripada bank soalan' },
      module: 'M10',
      v2: true,
    },
  },
  {
    path: '/guru/set-soalan/:id/keputusan',
    name: 'm10.guru-set-soalan-keputusan',
    component: () => import('./pages/SetSoalanGuruKeputusanPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['teacher'],
      title: 'Keputusan Set Soalan — PRESTASIPLUS',
      header: { title: 'Keputusan Set Soalan', subtitle: 'Hasil pelajar bagi set ini' },
      module: 'M10',
      v2: true,
    },
  },
  {
    path: '/guru/set-soalan/:id',
    name: 'm10.guru-set-soalan-urus',
    component: () => import('./pages/SetSoalanGuruFormPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['teacher'],
      title: 'Urus Set Soalan — PRESTASIPLUS',
      header: { title: 'Urus Set Soalan', subtitle: 'Kemas kini set dan kelas penerima' },
      module: 'M10',
      v2: true,
    },
  },
  { path: '/guru/set/cipta', redirect: '/guru/set-soalan/cipta' },
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
  ...setSoalanGuru,
  ...setSoalanSaya,
  ...soalan,
]

export default routes
