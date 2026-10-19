import type { RouteRecordRaw } from 'vue-router'

/**
 * M16 route fragment: S6 `/permainan` Zona Permainan (M16-T4a). User shell, every logged-in role. The shell
 * header is the page title with the user-portal subtitle (DV-M16-01), the tab title the live one (URS
 * FN-M16-1.1.3, 1.1.4).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/permainan',
    name: 'm16.permainan',
    component: () => import('../pages/PermainanPage.vue'),
    meta: {
      ownsH1: true,
      layout: 'user',
      access: 'auth',
      title: 'Permainan — PRESTASIPLUS',
      header: { title: 'Zona Permainan', subtitle: 'Selamat datang kembali' },
      module: 'M16',
      v2: true,
    },
  },
]

export default routes
