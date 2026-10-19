import type { RouteRecordRaw } from 'vue-router'

import { rolesOf } from './access'
import { STAFF_MOUNTS } from './mount'

/**
 * M12 route fragment: S7 Intervensi on `/admin/kirkpatrick/interventions` and the `/guru` twin (M12-T4). GET on
 * `/interventions/{id}` and `/interventions/create` is not a route: the global 404 page renders (DV-M12-11).
 */
const routes: RouteRecordRaw[] = STAFF_MOUNTS.map((mount): RouteRecordRaw => ({
  path: `${mount.prefix}/interventions`,
  name: `${mount.name}-interventions`,
  component: () => import('../pages/KirkpatrickInterventionsPage.vue'),
  props: () => ({ basePath: mount.prefix }),
  meta: {
    layout: mount.layout,
    access: 'auth',
    roles: rolesOf(mount),
    module: 'M12',
    v2: true,
    title: 'Intervensi — Kirkpatrick',
    header: {
      title: 'Intervensi Pelajar',
      subtitle: 'Rekod tindakan intervensi berdasarkan amaran Kirkpatrick',
    },
  },
}))

export default routes
