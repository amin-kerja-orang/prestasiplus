import type { RouteRecordRaw } from 'vue-router'

/**
 * M11 route fragment "laporan": S1 `/guru/laporan` (`?range=&classroom_id=`), user shell (FR-M11-04).
 * Teacher and admin only (M10 §7 **T** guard); other roles go to their landing page. `/guru/laporan/{x}`
 * matches nothing and renders the global 404 (FR-M11-07).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/guru/laporan',
    name: 'guru-laporan',
    component: () => import('../pages/LaporanPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['teacher', 'admin'],
      title: 'Laporan Statistik - Portal Guru',
      header: { title: 'Laporan Statistik', subtitle: 'Pantau penglibatan dan prestasi pelajar' },
      module: 'M11',
      v2: true,
    },
  },
]

export default routes
