import type { RouteRecordRaw } from 'vue-router'

/**
 * M15 route fragment: S5 `/gamification/rewards`, S6 `/gamification/mystery-box` and S7 `/cabutan`
 * (M15-T2). User shell, any logged-in role (FR-M15-09); a guest goes to `/login` by the shared
 * guard. Tab titles are the exact live strings (FN-M15-1.1.8); the shell header is the page h1
 * without its emoji and the subtitle "Selamat datang kembali" (DV-M15-12, DV-SH-03). The probed
 * sub-paths (`/gamification/rewards/1`, `/cabutan/sejarah`, ...) match no route, so the catch-all
 * renders the global 404 page (FR-M15-10).
 */
const SUBTITLE = 'Selamat datang kembali'

const routes: RouteRecordRaw[] = [
  {
    path: '/gamification/rewards',
    name: 'm15.rewards',
    component: () => import('../pages/RewardsShopPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Kedai Hadiah',
      header: { title: 'Kedai Hadiah', subtitle: SUBTITLE },
      module: 'M15',
      v2: true,
    },
  },
  {
    path: '/gamification/mystery-box',
    name: 'm15.mystery-box',
    component: () => import('../pages/MysteryBoxPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Kotak Misteri — PRESTASIPLUS',
      header: { title: 'Kotak Misteri', subtitle: SUBTITLE },
      module: 'M15',
      v2: true,
    },
  },
  {
    path: '/cabutan',
    name: 'm15.cabutan',
    component: () => import('../pages/CabutanPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Cabutan Bertuah - PRESTASIPLUS',
      header: { title: 'Cabutan Bertuah', subtitle: SUBTITLE },
      module: 'M15',
      v2: true,
    },
  },
]

export default routes
