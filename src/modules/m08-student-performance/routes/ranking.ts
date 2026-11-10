import type { RouteRecordRaw } from 'vue-router'

/**
 * M08 route fragment "ranking" (M08-T4): S19 `/ranking` "Kedudukan" and S20 `/leaderboard` "Papan
 * Pendahulu". Every role may open both (SRS §9); user shell (the admin sees it too, as on live).
 * S19's tab title is "Kedudukan | PRESTASIPLUS" (R1-MUR-18, the shell format) and its header is "Kedudukan" with the V2
 * sub-heading; S20's header is its live title and subtitle (FR-M08-03).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/ranking',
    name: 'm08.ranking',
    component: () => import('../pages/RankingPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Kedudukan',
      header: {
        title: 'Kedudukan',
        subtitle: 'Di mana anda berdiri — dalam kelas, sekolah, negeri dan seluruh negara',
      },
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
