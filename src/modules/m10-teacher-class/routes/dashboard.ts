import type { RouteRecordRaw } from 'vue-router'

import { GURU_API_ROLES } from './roles'

/**
 * M10 route fragment: S1 Dashboard Guru (`/guru`), M10-T2. User shell; Guru and Admin in mock mode (SRS §2
 * route table); Guru only in http mode (DV-M10-37: `GET /api/guru/dashboard` is teacher-only). The page
 * replaces the subtitle with "Selamat datang, {nama} 👩‍🏫" once the session user is known (FR-M10-03).
 */
export const GURU_DASHBOARD_ROUTE = 'm10.guru-dashboard'

const routes: RouteRecordRaw[] = [
  {
    path: '/guru',
    name: GURU_DASHBOARD_ROUTE,
    component: () => import('../pages/GuruDashboardPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: GURU_API_ROLES,
      title: 'Dashboard Guru - PRESTASIPLUS',
      header: { title: 'Dashboard Guru', subtitle: 'Selamat datang 👩‍🏫' },
      module: 'M10',
      v2: true,
    },
  },
]

export default routes
