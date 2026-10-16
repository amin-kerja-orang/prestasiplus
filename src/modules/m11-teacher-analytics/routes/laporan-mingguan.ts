import type { RouteRecordRaw } from 'vue-router'

/**
 * M11 route fragment "laporan-mingguan" (S8; build-plan §S.3 rule 2). Created empty by M11-T1; the UI task of the
 * screen fills it (M11-T2 S1 / S6, M11-T3 S2–S5 and the `/admin-sekolah/monitoring` alias, M11-T4 S8,
 * M11-T5 S7).
 *
 * Prototype scope (D43): the Guru "Laporan Mingguan" menu item (matrix row 43) points here, but the
 * screen is not built (the only existing page, M08 `/laporan-mingguan`, is a 403 for every role,
 * OQ-M08-01). The route renders the friendly "Belum tersedia dalam prototaip" page instead of a 404.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/guru/laporan-mingguan-kelas',
    name: 'm11.laporan-mingguan-kelas',
    component: () => import('@/pages/PrototypeUnavailablePage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['teacher', 'admin'],
      title: 'Belum Tersedia dalam Prototaip | PRESTASIPLUS',
      header: { title: 'Laporan Mingguan' },
      module: 'M11',
    },
  },
]

export default routes
