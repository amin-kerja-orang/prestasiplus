import type { RouteRecordRaw } from 'vue-router'

import { rolesOf } from './access'
import { ALL_MOUNTS } from './mount'

/**
 * M12 route fragment: S8 `.../pelajar/{id}` on the three prefixes (M12-T4, S6-T02). A non-numeric id matches no route (404); an id that is
 * not an accessible student (unknown, not a pupil, or outside the viewer's school) answers 404 NOT_FOUND from the API and
 * renders the 404 page in place (D-T02-2, ERR-ACC-02). The page sets the
 * header and tab title "Kirkpatrick — {nama}" once the student is loaded (DV-M12-03).
 */
const routes: RouteRecordRaw[] = ALL_MOUNTS.map((mount): RouteRecordRaw => ({
  path: `${mount.prefix}/pelajar/:userId(\\d+)`,
  name: `${mount.name}-pelajar`,
  component: () => import('../pages/KirkpatrickPelajarPage.vue'),
  props: (route) => ({ basePath: mount.prefix, userId: Number(route.params.userId) }),
  meta: {
    layout: mount.layout,
    access: 'auth',
    roles: rolesOf(mount),
    module: 'M12',
    v2: true,
    title: 'Kirkpatrick',
    header: { title: 'Kirkpatrick' },
  },
}))

export default routes
