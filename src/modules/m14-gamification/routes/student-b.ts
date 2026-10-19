import type { RouteRecordRaw } from 'vue-router'

/**
 * M14 route fragment "student-b": S14 `/gamification/leaderboard`, S15 `/gamification/achievements`,
 * S16 `/gamification/referral`, S18 `/gamification/kad-kongsi`; user shell, every logged-in role
 * (FR-M14-04, 05, 06). Header titles follow DV-M14-01 with the live subtitle "Selamat datang
 * kembali" (S14–S16) and S18's own live title and subtitle; tab titles are exact (FN-M14-1.1.6).
 */
const SUBTITLE = 'Selamat datang kembali'

const routes: RouteRecordRaw[] = [
  {
    path: '/gamification/leaderboard',
    name: 'gamification-leaderboard',
    component: () => import('../pages/student-b/LeaderboardPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Papan Pendahulu',
      header: { title: 'Papan Pendahulu', subtitle: SUBTITLE },
      module: 'M14',
      v2: true,
    },
  },
  {
    path: '/gamification/achievements',
    name: 'gamification-achievements',
    component: () => import('../pages/student-b/AchievementsPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Pencapaian — PRESTASIPLUS',
      header: { title: 'Pencapaian Anda', subtitle: SUBTITLE },
      module: 'M14',
      v2: true,
    },
  },
  {
    path: '/gamification/referral',
    name: 'gamification-referral',
    component: () => import('../pages/student-b/ReferralPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Rujuk Kawan — PRESTASIPLUS',
      header: { title: 'Rujuk Kawan, Dapat Syiling!', subtitle: SUBTITLE },
      module: 'M14',
      v2: true,
    },
  },
  {
    path: '/gamification/kad-kongsi',
    name: 'gamification-kad-kongsi',
    component: () => import('../pages/student-b/KadKongsiPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Kad Kongsi — PRESTASIPLUS',
      header: { title: 'Kad Kongsi', subtitle: 'Kongsi pencapaian anda' },
      module: 'M14',
      v2: true,
    },
  },
]

export default routes
