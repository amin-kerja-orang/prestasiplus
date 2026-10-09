import type { RouteRecordRaw } from 'vue-router'

import { formatCount } from '@/lib/number'

import { S3_SCHOOL_COUNT } from '../api/constants'

/**
 * M16 route fragment: S1-S5 Battle Arena, rankings, school detail, history and the provisional arena
 * (M16-T3). User shell, every logged-in role (FR-M16-05); header and tab titles are the live ones
 * (URS FN-M16-1.1.3, 1.1.4). S4 takes its header and tab title from the loaded school (the page sets
 * them; the meta here is the fallback while it loads). `/battle/arena` without a uuid and
 * `/battle/riwayat` are not routes (404 through the catch-all, FR-M16-06).
 */
function battleRoute(
  path: string,
  name: string,
  component: NonNullable<RouteRecordRaw['component']>,
  title: string,
  subtitle: string,
): RouteRecordRaw {
  return {
    path,
    name,
    component,
    meta: {
      layout: 'user',
      access: 'auth',
      title,
      header: { title, subtitle },
      module: 'M16',
    },
  }
}

const routes: RouteRecordRaw[] = [
  battleRoute(
    '/battle',
    'battle',
    () => import('../pages/BattleLobbyPage.vue'),
    'Battle Arena',
    'Bertanding kuiz 1v1 dengan pelajar lain!',
  ),
  battleRoute(
    '/battle/arena/:uuid',
    'battle-arena',
    () => import('../pages/BattleArenaPage.vue'),
    'Battle Arena',
    'Bertanding kuiz 1v1 dengan pelajar lain!',
  ),
  battleRoute(
    '/battle/leaderboard',
    'battle-leaderboard',
    () => import('../pages/BattleLeaderboardPage.vue'),
    'Ranking Pelajar Battle',
    'Siapa pejuang terhebat minggu ini?',
  ),
  battleRoute(
    '/battle/ranking-sekolah',
    'battle-ranking-sekolah',
    () => import('../pages/BattleSchoolRankingPage.vue'),
    'Papan Ranking Sekolah',
    `Ranking ${formatCount(S3_SCHOOL_COUNT)} sekolah seluruh Malaysia`,
  ),
  battleRoute(
    '/battle/ranking-sekolah/:id(\\d+)',
    'battle-school-detail',
    () => import('../pages/BattleSchoolDetailPage.vue'),
    'Papan Ranking Sekolah',
    '',
  ),
  battleRoute(
    '/battle/history',
    'battle-history',
    () => import('../pages/BattleHistoryPage.vue'),
    'Sejarah Battle',
    'Rekod pertandingan anda',
  ),
]

export default routes
