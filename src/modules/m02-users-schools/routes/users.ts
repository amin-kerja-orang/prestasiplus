import type { RouteRecordRaw } from 'vue-router'

import { USER_ROUTES } from '../lib/user-list'

/**
 * M02 route fragment: S1 user list (M02-T4; FR-M02-01). Admin only, admin shell. The tab title is
 * exact (SRS §2).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin/users',
    name: USER_ROUTES.list,
    component: () => import('../pages/UserListPage.vue'),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: 'Pengurusan Pengguna - Admin Panel',
      header: { title: 'Pengurusan Pengguna', subtitle: 'Urus akaun pengguna PRESTASIPLUS' },
      module: 'M02',
    },
  },
]

export default routes
