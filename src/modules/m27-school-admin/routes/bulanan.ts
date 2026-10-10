import type { RouteRecordRaw } from 'vue-router'

/**
 * M27 route fragment: S5 `/admin-sekolah/laporan-bulanan` "Laporan Bulanan" (SRS M27 Part B v1.8 §14.2;
 * FR-M27-38, 40, 44; PROPOSED screen, D26). User shell, role `school_admin` only, in-place 403 for other
 * roles, `/login` for a guest.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin-sekolah/laporan-bulanan',
    name: 'm27.laporan-bulanan',
    component: () => import('../pages/LaporanBulananPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['school_admin'],
      onForbidden: '403',
      title: 'Laporan Bulanan - PRESTASIPLUS',
      header: { title: 'Laporan Bulanan' },
      module: 'M27',
    },
  },
]

export default routes
