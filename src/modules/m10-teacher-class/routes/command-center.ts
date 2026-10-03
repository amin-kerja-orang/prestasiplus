import type { RouteRecordRaw } from 'vue-router'

import { commandCenterDrillRoutes } from '@/modules/m17-admin-dashboard'

/**
 * M10 route fragment: S2 Command Center (`/guru/command-center`, standalone dark layout, teacher and admin; SRS
 * §2, §9) and the mounted M17 S4-S7 drill-downs under `/guru/command-center/…` (FR-M10-26, FR-M17-60), M10-T4.
 * The tab title is set from the data ("Command Center — Guru: {nama}"). The drill-down handlers scope a teacher
 * per BR-M17-30 (404 outside the scope).
 */
const roles = ['teacher', 'admin'] as const

const routes: RouteRecordRaw[] = [
  {
    path: '/guru/command-center',
    name: 'guru-command-center',
    component: () => import('../pages/CommandCenterPage.vue'),
    meta: {
      layout: 'bare',
      access: 'auth',
      roles,
      title: 'Command Center — Guru',
      module: 'M10',
    },
  },
  ...commandCenterDrillRoutes({
    prefix: '/guru/command-center',
    namePrefix: 'm10.cc',
    roles,
  }),
]

export default routes
