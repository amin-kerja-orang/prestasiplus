import type { RouteRecordRaw } from 'vue-router'

import { STAFF_MOUNTS } from './mount'

/** M12 route fragment: S2 T1 Reaksi on `/admin/kirkpatrick/reaction` and the `/guru` twin (M12-T2). */
const routes: RouteRecordRaw[] = STAFF_MOUNTS.map((mount): RouteRecordRaw => ({
  path: `${mount.prefix}/reaction`,
  name: `${mount.name}-reaction`,
  component: () => import('../pages/KirkpatrickReactionPage.vue'),
  props: () => ({ basePath: mount.prefix }),
  meta: {
    layout: mount.layout,
    access: 'auth',
    roles: mount.roles,
    module: 'M12',
    v2: true,
    title: 'Tahap 1: Reaksi — Kirkpatrick',
    header: {
      title: 'Tahap 1: Reaksi',
      subtitle: 'Kepuasan dan persepsi pengguna terhadap platform',
    },
  },
}))

export default routes
