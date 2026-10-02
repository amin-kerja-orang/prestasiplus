import type { RouteRecordRaw } from 'vue-router'

import { AUDIT_ROUTES } from '../lib/audit-routes'

/**
 * M04 route fragment: S12 master notes (M04-T7; FR-M04-102..105). Rendered in the **user** shell with
 * the admin role, as live (build-plan M04-T7). The shell header is the readable title with no
 * subtitle (DV-M04-02, FN-M04-6.2.5).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin/master-notes',
    name: AUDIT_ROUTES.masterNotes,
    component: () => import('../pages/MasterNotesPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['admin'],
      title: 'Master Notes — Admin Review',
      header: { title: 'Master Notes — Admin Review' },
      module: 'M04',
    },
  },
]

export default routes
