import type { RouteRecordRaw } from 'vue-router'

import { rolesOf } from './access'
import { STAFF_MOUNTS } from './mount'

/** M12 route fragment: S5 T4 Hasil on `/admin/kirkpatrick/results` and the `/guru` twin (M12-T3). */
const routes: RouteRecordRaw[] = STAFF_MOUNTS.map((mount): RouteRecordRaw => ({
  path: `${mount.prefix}/results`,
  name: `${mount.name}-results`,
  component: () => import('../pages/KirkpatrickResultsPage.vue'),
  props: () => ({ basePath: mount.prefix }),
  meta: {
    layout: mount.layout,
    access: 'auth',
    roles: rolesOf(mount),
    module: 'M12',
    title: 'Tahap 4: Hasil — Kirkpatrick',
    header: {
      title: 'Tahap 4: Hasil',
      subtitle: 'Impak terhadap keputusan peperiksaan dan prestasi akademik',
    },
  },
}))

export default routes
