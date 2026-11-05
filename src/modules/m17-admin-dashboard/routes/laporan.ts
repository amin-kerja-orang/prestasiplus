import type { RouteRecordRaw } from 'vue-router'

/**
 * M17 route fragment: `/admin/laporan` Laporan (R1-ADM-M-06). Admin Pusat only, admin shell (S6-T11).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin/laporan',
    name: 'm17.admin-laporan',
    component: () => import('../pages/AdminLaporanPage.vue'),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: 'Laporan - Admin Panel',
      header: { title: 'Laporan', subtitle: 'Laporan aktiviti' },
      module: 'M17',
      v2: true,
    },
  },
]

export default routes
