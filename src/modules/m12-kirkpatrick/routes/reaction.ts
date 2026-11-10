import type { RouteRecordRaw } from 'vue-router'

import { ALL_MOUNTS } from './mount'

/** M12 route fragment: S2 T1 Reaksi on `/admin/kirkpatrick/reaction` and the `/guru` twin (M12-T2). */
const routes: RouteRecordRaw[] = ALL_MOUNTS.map((mount): RouteRecordRaw => ({
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
    title: 'T1: Reaksi',
    header: {
      title: 'T1: Reaksi',
      subtitle: 'Kirkpatrick Tahap 1 — Kepuasan pengguna',
    },
  },
}))

export default routes
