import type { RouteRecordRaw } from 'vue-router'

/**
 * M15 route fragment: S10 `/cikgu/hadiah` (`?cat=`) and S11 `/cikgu/hadiah/saya` (roles-matrix row
 * L43, SRS M15 v1.6). User shell, any logged-in role (FR-M15-76); a guest goes to `/login` by the
 * shared guard. The tab titles are the live ones, the shell header is the page title with
 * "Selamat datang kembali" (DV-M15-17). `/cikgu/hadiah/1` (any id other than `saya`) matches no
 * route, so the catch-all renders the global 404 page (FR-M15-77).
 */
const SUBTITLE = 'Selamat datang kembali'

const routes: RouteRecordRaw[] = [
  {
    path: '/cikgu/hadiah',
    name: 'm15.digital-shop',
    component: () => import('../pages/DigitalShopPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Kedai Hadiah Digital',
      header: { title: 'Kedai Hadiah Digital', subtitle: SUBTITLE },
      module: 'M15',
      v2: true,
    },
  },
  {
    path: '/cikgu/hadiah/saya',
    name: 'm15.digital-redemptions',
    component: () => import('../pages/MyRedemptionsPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Tebusan Saya',
      header: { title: 'Tebusan Saya', subtitle: SUBTITLE },
      module: 'M15',
      v2: true,
    },
  },
]

export default routes
