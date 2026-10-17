import type { RouteRecordRaw } from 'vue-router'

/**
 * M05 route fragment: S8 Kemajuan and S9 Sejarah. Static siblings of `/practice/:code`, so they rank
 * above it by the router. Any session may open them (FR-M05-130). S11 / S12 are not in this fragment yet.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/practice/progress',
    name: 'm05.progress',
    component: () => import('../pages/ProgressPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Kemajuan Saya - PRESTASIPLUS',
      header: { title: 'Kemajuan Saya' },
      module: 'M05',
      v2: true,
    },
  },
  {
    path: '/practice/history',
    name: 'm05.history',
    component: () => import('../pages/HistoryPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Sejarah Latihan - PRESTASIPLUS',
      header: { title: 'Sejarah Latihan' },
      module: 'M05',
      v2: true,
    },
  },
]

export default routes
