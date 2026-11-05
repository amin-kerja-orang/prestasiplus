import type { RouteRecordRaw } from 'vue-router'

/** M11 route fragment "laporan-mingguan": S6-T01 Laporan Mingguan Guru (R1-GUR-43). */
const routes: RouteRecordRaw[] = [
  {
    path: '/guru/laporan-mingguan-kelas',
    name: 'm11.laporan-mingguan-kelas',
    component: () => import('../pages/LaporanMingguanGuruPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['teacher'],
      title: 'Laporan Mingguan — PRESTASIPLUS',
      header: { title: 'Laporan Mingguan' },
      module: 'M11',
      v2: true,
    },
  },
  { path: '/guru/laporan-mingguan', redirect: '/guru/laporan-mingguan-kelas' },
]

export default routes
