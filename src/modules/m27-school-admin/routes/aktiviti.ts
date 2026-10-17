import type { RouteRecordRaw } from 'vue-router'

/**
 * M27 route fragment: S3 `/admin-sekolah/laporan-aktiviti` "Laporan Aktiviti" (SRS M27 Part B FR-M27-38, 44,
 * 66…73; roles-matrix row L53). User shell, role `school_admin` only: every other signed-in role gets the
 * in-place 403 page (FR-M27-40); a guest goes to `/login`. The header sub-line (the school name) is set by the
 * page. `?range=7|30|90`, anything else = 30.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin-sekolah/laporan-aktiviti',
    name: 'm27.laporan-aktiviti',
    component: () => import('../pages/LaporanAktivitiPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['school_admin'],
      onForbidden: '403',
      title: 'Laporan Aktiviti - PRESTASIPLUS',
      header: { title: 'Laporan Aktiviti' },
      module: 'M27',

      v2: true,
    },
  },
]

export default routes
