import type { RouteRecordRaw } from 'vue-router'

/**
 * M14 route fragment "student-a": S11 `/gamification`, S12 `/gamification/convert`, S13
 * `/gamification/challenges`, S17 `/gamification/history`, user shell, every logged-in role
 * (FR-M14-04, 05, 06; DV-M14-01 header titles with the live subtitle "Selamat datang kembali";
 * tab titles exact, FN-M14-1.1.6).
 */
const SUBTITLE = 'Selamat datang kembali'

const routes: RouteRecordRaw[] = [
  {
    path: '/gamification',
    name: 'gamification-dashboard',
    component: () => import('../pages/GamificationDashboardPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Gamifikasi Dashboard',
      header: { title: 'Gamifikasi Dashboard', subtitle: SUBTITLE },
      module: 'M14',
    },
  },
  {
    path: '/gamification/convert',
    name: 'gamification-convert',
    component: () => import('../pages/GamificationConvertPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Tukar Token',
      header: { title: 'Tukar Syiling → Token', subtitle: SUBTITLE },
      module: 'M14',
    },
  },
  {
    path: '/gamification/challenges',
    name: 'gamification-challenges',
    component: () => import('../pages/GamificationChallengesPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Cabaran Harian',
      header: { title: 'Cabaran Harian', subtitle: SUBTITLE },
      module: 'M14',
    },
  },
  {
    path: '/gamification/history',
    name: 'gamification-history',
    component: () => import('../pages/GamificationHistoryPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Sejarah Transaksi',
      header: { title: 'Sejarah Transaksi', subtitle: SUBTITLE },
      module: 'M14',
    },
  },
]

export default routes
