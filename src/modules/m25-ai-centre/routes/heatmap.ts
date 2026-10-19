import type { RouteRecordRaw } from 'vue-router'

/**
 * M25 route fragment: S1 Heatmap Topik Lemah (`/buku-nota/heatmap`, M25-T2). User shell; only `student` and
 * `admin` open it, every other signed-in role goes to its landing page (XR-M25-06, SERVER gate `role:pelajar`);
 * a guest goes to `/login`. Header title "Heatmap Topik Lemah" instead of the live "Dashboard" (DV-M25-01); the
 * tab title is exact. `/heatmap-topik-lemah` is deliberately not defined: it falls to the global 404 (DV-M25-09).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/buku-nota/heatmap',
    name: 'm25.heatmap',
    component: () => import('../pages/HeatmapTopikLemahPage.vue'),
    meta: {
      ownsH1: true,
      layout: 'user',
      access: 'auth',
      roles: ['student', 'admin'],
      onForbidden: 'landing',
      title: 'Heatmap Topik Lemah',
      header: { title: 'Heatmap Topik Lemah', subtitle: 'Selamat datang kembali' },
      module: 'M25',
      v2: true,
    },
  },
]

export default routes
