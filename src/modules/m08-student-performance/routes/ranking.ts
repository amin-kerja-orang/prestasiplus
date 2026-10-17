import type { RouteRecordRaw } from 'vue-router'

/**
 * M08 route fragment "ranking" (M08-T4): S19 `/ranking` "Kedudukan" and S20 `/leaderboard` "Papan
 * Pendahulu". Every role may open both (SRS §9); user shell (the admin sees it too, as on live).
 * S19's tab title is "Kedudukan {x}" and is set by the page (DV-22); the route title is the national
 * default. S19's shell header is the DV-01 title "Kedudukan" with "Selamat datang kembali"
 * (FR-M08-04); S20's header is its live title and subtitle (FR-M08-03).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/ranking',
    name: 'm08.ranking',
    component: () => import('../pages/RankingPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Kedudukan Nasional',
      header: { title: 'Kedudukan', subtitle: 'Selamat datang kembali' },
      module: 'M08',
      v2: true,
    },
  },
  {
    path: '/leaderboard',
    name: 'm08.leaderboard',
    component: () => import('../pages/LeaderboardPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Papan Pendahulu - PRESTASIPLUS',
      header: { title: 'Papan Pendahulu', subtitle: 'Siapa juara minggu ini?' },
      module: 'M08',
      v2: true,
    },
  },
]

export default routes
