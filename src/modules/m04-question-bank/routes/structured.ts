import type { RouteRecordRaw } from 'vue-router'

import { AUDIT_ROUTES } from '../lib/audit-routes'

/**
 * M04 route fragment: S8 structured list, S9 structured detail (M04-T7; FR-M04-83..90). Admin shell,
 * admin only. Tab titles are exact (SRS §2). The shell header is the route title with no subtitle
 * (FR-M04-107, DV-M04-02).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin/structured-questions',
    name: AUDIT_ROUTES.structuredList,
    component: () => import('../pages/StructuredListPage.vue'),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: 'Soalan Berstruktur',
      header: { title: 'Soalan Berstruktur' },
      module: 'M04',
    },
  },
  {
    path: '/admin/structured-questions/:id(\\d+)',
    name: AUDIT_ROUTES.structuredDetail,
    component: () => import('../pages/StructuredDetailPage.vue'),
    props: (route) => ({ id: Number(route.params.id) }),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: 'Detail Soalan Berstruktur',
      header: { title: 'Detail Soalan Berstruktur' },
      module: 'M04',
    },
  },
]

export default routes
