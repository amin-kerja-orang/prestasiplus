import type { RouteRecordRaw } from 'vue-router'

/**
 * M10 route fragment: S34 Set Soalan Guru, student (`/set-soalan-saya`), M10-T7b. User shell;
 * Pelajar and Admin only. Tab title "Set Soalan Guru - PRESTASIPLUS", header "Set Soalan Guru" /
 * "Set soalan yang disediakan oleh guru anda" (observed). The quiz route
 * `/set-soalan-saya/:id/jawab` belongs to M05.
 */
export const SET_SOALAN_SAYA_ROUTE = 'm10.set-soalan-saya'

const routes: RouteRecordRaw[] = [
  {
    path: '/set-soalan-saya',
    name: SET_SOALAN_SAYA_ROUTE,
    component: () => import('../pages/SetSoalanSayaPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['student', 'admin'],
      title: 'Set Soalan Guru - PRESTASIPLUS',
      header: { title: 'Set Soalan Guru', subtitle: 'Set soalan yang disediakan oleh guru anda' },
      module: 'M10',
      v2: true,
    },
  },
]

export default routes
