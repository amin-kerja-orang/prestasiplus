import type { RouteRecordRaw } from 'vue-router'

/**
 * M27 route fragment: S1 `/admin-sekolah/statistik-penggunaan` "Statistik Penggunaan" (SRS M27 Part B
 * FR-M27-38, 44, 51…57; roles-matrix row L51). User shell, role `school_admin` only: every other signed-in
 * role gets the in-place 403 page (FR-M27-40); a guest goes to `/login`. The header sub-line (the school
 * name) is set by the page once its data has loaded. `?period=today|7days|30days`, anything else = `30days`.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin-sekolah/statistik-penggunaan',
    name: 'm27.statistik-penggunaan',
    component: () => import('../pages/StatistikPenggunaanPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['school_admin'],
      onForbidden: '403',
      title: 'Statistik Penggunaan - PRESTASIPLUS',
      header: { title: 'Statistik Penggunaan' },
      module: 'M27',

      v2: true,
    },
  },
]

export default routes
