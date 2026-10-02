import type { RouteRecordRaw } from 'vue-router'

import { REPORT_ROUTES } from '../lib/report-routes'

/**
 * M04 route fragment: S13 my question reports (M04-T6b). User shell; any logged-in user (SRS §9: the
 * admin sees the empty state). S13 keeps its live shell title and subtitle (FR-M04-107).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/laporan-soalan',
    name: REPORT_ROUTES.mine,
    component: () => import('../pages/LaporanSoalanPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Laporan Soalan Saya',
      header: {
        title: 'Laporan Soalan Saya',
        subtitle: 'Jejak status laporan soalan yang anda hantar',
      },
      module: 'M04',
    },
  },
]

export default routes
