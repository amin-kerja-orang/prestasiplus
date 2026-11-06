import type { RouteRecordRaw } from 'vue-router'

import { AUDIT_ROUTES } from '../lib/audit-routes'

/**
 * M04 route fragment: Kertas Soalan Guru (R1-ADM-Q-12). Admin shell, admin only. The intro is the
 * subtitle of `DsPage`; the portal header reads it from there.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin/question-submissions',
    name: AUDIT_ROUTES.submissions,
    component: () => import('../pages/SubmissionListPage.vue'),
    meta: {
      layout: 'admin',
      v2: true,
      access: 'auth',
      roles: ['admin'],
      title: 'Kertas Soalan Guru - Admin Panel',
      header: { title: 'Kertas Soalan Guru' },
      module: 'M04',
    },
  },
]

export default routes
