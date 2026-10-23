import type { RouteRecordRaw } from 'vue-router'

/**
 * M10 route fragment: S1 Dashboard Guru (`/guru`), M10-T2. User shell; Guru only (SRS §2 route table;
 * DV-M10-37: `GET /api/guru/dashboard` is teacher-only, so admin is not admitted). The page replaces the
 * subtitle with "Selamat datang, {nama} 👩‍🏫" once the session user is known (FR-M10-03).
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
      roles: ['teacher'],
      title: 'Dashboard Guru - PRESTASIPLUS',
      header: { title: 'Dashboard Guru', subtitle: 'Selamat datang 👩‍🏫' },
      module: 'M10',
      v2: true,
    },
  },
]

export default routes
