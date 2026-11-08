import type { RouteRecordRaw } from 'vue-router'

/** R1-ADM-N-05 `/admin/permainan` "Tetapan Permainan" (admin shell, platform admin only). */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin/permainan',
    name: 'm16.admin-settings',
    component: () => import('../pages/TetapanPermainanPage.vue'),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: '🎮 Tetapan Permainan - Admin Panel',
      header: {
        title: 'Tetapan Permainan',
        subtitle: 'Urus konfigurasi Papan Bijak, Kad Memori & permainan lain',
      },
      module: 'M16',
      v2: true,
    },
  },
]

export default routes
