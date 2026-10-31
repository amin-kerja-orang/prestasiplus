import type { RouteRecordRaw } from 'vue-router'

import { BUILDER_ROUTES } from '../admin/builder/server/api'

/**
 * Set Builder (R1-F08, `docs/design/v2-admin-student-pipeline.md` S4.1 and S4.2): the landing with
 * Mula kosong / Jana set / Pratonton kolam, and the builder of one set. Admin Pusat only; the
 * Pentadbiran menu entry KS-17 points at the landing.
 */
const base = {
  layout: 'admin',
  access: 'auth',
  roles: ['admin'],
  module: 'M06',
  v2: true,
} as const

const routes: RouteRecordRaw[] = [
  {
    path: '/admin/studio/sets',
    name: BUILDER_ROUTES.landing,
    component: () => import('../admin/builder/pages/SetBuilderLandingPage.vue'),
    meta: {
      ...base,
      title: 'Set Builder - Admin PRESTASIPLUS',
      header: { title: 'Set Builder', subtitle: 'Kertas latihan daripada bank soalan percubaan' },
    },
  },
  {
    path: '/admin/studio/sets/:paper/builder',
    name: BUILDER_ROUTES.builder,
    component: () => import('../admin/builder/pages/SetBuilderPage.vue'),
    meta: {
      ...base,
      title: 'Set Builder - Admin PRESTASIPLUS',
      header: { title: 'Set Builder' },
    },
  },
]

export default routes
