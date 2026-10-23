import type { RouteRecordRaw } from 'vue-router'

import { monitoringRoutes } from '@/modules/m11-teacher-analytics'

/**
 * M17 route fragment: the mount of the M11 monitoring component on `/admin/monitoring*` (FR-M17-10;
 * M11-T3 builds the component). Without it every `/admin/monitoring...` link of the Kirkpatrick pages
 * and the M11 drill-downs answers the 404 page for the admin (SWEEP-23OCT D4).
 */
const routes: RouteRecordRaw[] = monitoringRoutes({
  name: 'admin-monitoring',
  prefix: '/admin/monitoring',
  layout: 'admin',
  roles: ['admin'],
})

export default routes
