import type { RouteRecordRaw } from 'vue-router'

/**
 * M01 route fragment: S9 Tetapan Peribadi (M01-T7a user shell; T7b adds the admin variant through
 * the same `layout: 'role'` route). Tab title is exact, no suffix (observed). The header carries
 * no subtitle (DV-13, DV-SH-07).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/tetapan',
    name: 'm01.tetapan',
    component: () => import('../pages/TetapanPage.vue'),
    meta: {
      layout: 'role',
      access: 'auth',
      title: 'Tetapan Peribadi',
      header: { title: 'Tetapan Peribadi' },
      module: 'M01',
    },
  },
]

export default routes
