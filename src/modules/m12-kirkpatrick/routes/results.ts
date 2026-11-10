import type { RouteRecordRaw } from 'vue-router'

import { rolesOf } from './access'
import { ALL_MOUNTS } from './mount'

/** M12 route fragment: S5 T4 Hasil on `/admin/kirkpatrick/results` and the `/guru` twin (M12-T3). */
const routes: RouteRecordRaw[] = ALL_MOUNTS.map((mount): RouteRecordRaw => ({
  path: `${mount.prefix}/results`,
  name: `${mount.name}-results`,
  component: () => import('../pages/KirkpatrickResultsPage.vue'),
  props: () => ({ basePath: mount.prefix }),
  meta: {
    layout: mount.layout,
    access: 'auth',
    roles: rolesOf(mount),
    module: 'M12',
    v2: true,
    title: 'T4: Hasil',
    header: {
      title: 'T4: Hasil',
      subtitle: 'Kirkpatrick Tahap 4 — Keputusan peperiksaan',
    },
  },
}))

export default routes
