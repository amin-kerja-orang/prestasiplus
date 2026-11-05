import type { RouteRecordRaw } from 'vue-router'

/**
 * M16 route fragment: `/sekolah-bersaing`, the live school board (R1-AS-45). Restricted to the school
 * admin and the admin (OQ-API-09, FR-X2-4): a guest goes to `/login` by the shared guard and any other
 * role sees the global 403 page in place. `layout: 'user'` gives each of the two its own frame
 * (Pembelajaran for the school admin, Pentadbiran for the admin).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/sekolah-bersaing',
    name: 'm16.sekolah-bersaing',
    component: () => import('../pages/SekolahBersaingPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['school_admin', 'admin'],
      onForbidden: '403',
      title: 'Sekolah Bersaing — PRESTASIPLUS',
      header: { title: 'Sekolah Bersaing', subtitle: 'Selamat datang kembali' },
      module: 'M16',
      v2: true,
    },
  },
]

export default routes
