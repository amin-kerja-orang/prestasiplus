import type { RouteRecordRaw } from 'vue-router'

import { AUDIT_ROUTES } from '../lib/audit-routes'

/**
 * M04 route fragment: S11 diagram audit (M04-T7; FR-M04-95..101). Admin layout key (teacher and school admin get
 * the Pembelajaran shell), open to admin, teacher and school_admin (S6-T18), no admin sidebar item. S11 keeps its live shell title and subtitle (FR-M04-107).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin/soalan-gambar',
    name: AUDIT_ROUTES.diagrams,
    component: () => import('../pages/DiagramAuditPage.vue'),
    meta: {
      layout: 'admin',
      v2: true,
      access: 'auth',
      roles: ['admin', 'teacher', 'school_admin'],
      title: 'Soalan Perlu Gambar Rajah - Admin',
      header: {
        title: 'Soalan Perlu Gambar Rajah',
        subtitle: 'Audit soalan yang memerlukan gambar rajah dilengkapkan',
      },
      module: 'M04',
    },
  },
]

export default routes
