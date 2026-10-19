import type { RouteRecordRaw } from 'vue-router'

import { AUDIT_ROUTES } from '../lib/audit-routes'

/**
 * M04 route fragment: S10 teacher question papers (M04-T7; FR-M04-91..94). Admin shell, admin only.
 * S10 keeps its live shell title and subtitle (FR-M04-107).
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
      title: 'Kertas Soalan - Admin',
      header: {
        title: 'Kertas Soalan Guru',
        subtitle: 'Semak dan proses fail soalan yang dihantar oleh guru',
      },
      module: 'M04',
    },
  },
]

export default routes
