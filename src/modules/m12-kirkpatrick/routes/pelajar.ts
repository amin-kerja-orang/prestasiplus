import type { RouteRecordRaw } from 'vue-router'

import { rolesOf } from './access'
import { STAFF_MOUNTS } from './mount'

/**
 * M12 route fragment: S8 `.../pelajar/{id}` on both prefixes (M12-T4). A non-numeric id matches no route (404); an id that is
 * not an accessible student answers 403 from the API and renders the 403 page in place (FR-M12-17). The page sets the
 * header and tab title "Kirkpatrick — {nama}" once the student is loaded (DV-M12-03).
 */
const routes: RouteRecordRaw[] = STAFF_MOUNTS.map((mount): RouteRecordRaw => ({
  path: `${mount.prefix}/pelajar/:userId(\\d+)`,
  name: `${mount.name}-pelajar`,
  component: () => import('../pages/KirkpatrickPelajarPage.vue'),
  props: (route) => ({ basePath: mount.prefix, userId: Number(route.params.userId) }),
  meta: {
    layout: mount.layout,
    access: 'auth',
    roles: rolesOf(mount),
    module: 'M12',
    title: 'Kirkpatrick',
    header: { title: 'Kirkpatrick' },
  },
}))

export default routes
