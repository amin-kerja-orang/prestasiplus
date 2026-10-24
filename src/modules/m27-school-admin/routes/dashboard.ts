import type { RouteRecordRaw } from 'vue-router'

/**
 * M27 route fragment: S0 `/admin-sekolah` "Dashboard Sekolah" (SRS M27 v1.3 §2, FR-M27-01, 03, 07).
 *
 * User shell, role `school_admin` only. Every other signed-in role gets the in-place 403 page (BR-M27-02,
 * the rule of the M17 alias routes); a guest goes to `/login` (the router guard). A school admin without a
 * school gets the same 403 page from the page itself (the endpoint answers 403, FR-M27-08). The header
 * subtitle (the school name) is set by the page once its data has loaded. `/admin-sekolah/pilih-sekolah`
 * is deliberately not defined: it falls to the global 404 page (FR-M27-10, DV-M27-01).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin-sekolah',
    name: 'm27.dashboard',
    component: () => import('../pages/SchoolDashboardPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['school_admin'],
      onForbidden: '403',
      title: 'Papan Pemuka Sekolah - PRESTASIPLUS',
      header: { title: 'Papan Pemuka Sekolah' },
      module: 'M27',

      v2: true,
    },
  },
]

export default routes
