import type { RouteRecordRaw } from 'vue-router'

/**
 * M13 route fragment: S1 `/cikgu` (M13-T2). User shell, every logged-in role (FR-M13-05..07; the
 * mock tier of the role is a data matter, not a route one). Header and tab title are the live ones
 * with the subtitle fix of DV-M13-08 (URS FN-M13-1.1.5, 1.1.6). `/cikgu/` resolves here too (vue-router
 * is not strict about trailing slashes, FR-M13-10).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/cikgu',
    name: 'cikgu',
    component: () => import('../pages/ChatPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Cikgu Alesa',
      header: { title: 'Cikgu Alesa', subtitle: 'Selamat datang kembali' },
      module: 'M13',
      v2: true,
    },
  },
]

export default routes
