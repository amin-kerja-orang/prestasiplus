import type { RouteRecordRaw } from 'vue-router'

/**
 * M17 route fragment: `/admin` Dashboard (R1-ADM-M-01). Admin Pusat only, admin shell (S6-T11).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin',
    name: 'm17.admin-dashboard',
    component: () => import('../pages/AdminDashboardPage.vue'),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: 'Dashboard - Admin Panel',
      header: { title: 'Dashboard', subtitle: 'Gambaran Keseluruhan Platform' },
      module: 'M17',
      v2: true,
    },
  },
]

export default routes
