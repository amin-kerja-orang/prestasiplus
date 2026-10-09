import type { RouteRecordRaw } from 'vue-router'

/**
 * M16 route fragment: S28 `/sekolah-bersaing` (`?week=`; M16-T6a, SRS M16 v1.6 FR-M16-127..131, DV-M16-02,
 * DV-M16-30). User shell for **every** logged-in role (no `roles`): the admin and the school admin
 * (roles-matrix row L50) open it in the user shell like the student. Tab title is the live one; the
 * shell header is the page title with the user-portal subtitle (DV-M16-02). A guest goes to `/login`
 * by the shared guard.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/sekolah-bersaing',
    name: 'm16.sekolah-bersaing',
    component: () => import('../pages/SekolahBersaingPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Sekolah Bersaing — Leaderboard Mingguan',
      header: { title: 'Sekolah Bersaing', subtitle: 'Selamat datang kembali' },
      module: 'M16',
    },
  },
]

export default routes
