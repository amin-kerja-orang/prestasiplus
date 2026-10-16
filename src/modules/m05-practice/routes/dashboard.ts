import type { RouteRecordRaw } from 'vue-router'

/**
 * M05 route fragment: S1 Dashboard (M05-T3; SRS M05 §2). Every route needs a session (FR-M05-130:
 * the default `access: 'auth'`). Registering `/dashboard` replaces the D20 preview-hub placeholder.
 * The header and tab title are the live ones for S1 (FR-M05-01).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/dashboard',
    name: 'm05.dashboard',
    component: () => import('../pages/DashboardPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Dashboard - PRESTASIPLUS',
      header: { title: 'Dashboard', subtitle: 'Selamat datang kembali' },
      module: 'M05',
      v2: true,
    },
  },
]

export default routes
