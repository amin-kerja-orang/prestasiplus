import type { RouteRecordRaw } from 'vue-router'

/**
 * M27 route fragment: S2 `/admin-sekolah/dskp-heatmap` "DSKP Heatmap" (SRS M27 Part B v1.8 §14.2; FR-M27-38,
 * 40, 44; PROPOSED screen, D26). User shell, role `school_admin` only; every other signed-in role gets the
 * in-place 403 page, a guest goes to `/login` (the router guard). The header sub-line (the school name) is set
 * by the page once its data has loaded.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin-sekolah/dskp-heatmap',
    name: 'm27.dskp-heatmap',
    component: () => import('../pages/DskpHeatmapPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['school_admin'],
      onForbidden: '403',
      title: 'DSKP Heatmap - PRESTASIPLUS',
      header: { title: 'DSKP Heatmap' },
      module: 'M27',

      v2: true,
    },
  },
]

export default routes
