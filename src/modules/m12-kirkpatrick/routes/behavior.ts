import type { RouteRecordRaw } from 'vue-router'

import { rolesOf } from './access'
import { STAFF_MOUNTS } from './mount'

/** M12 route fragment: S4 T3 Tingkah Laku on `/admin/kirkpatrick/behavior` and the `/guru` twin (M12-T3). */
const routes: RouteRecordRaw[] = STAFF_MOUNTS.map((mount): RouteRecordRaw => ({
  path: `${mount.prefix}/behavior`,
  name: `${mount.name}-behavior`,
  component: () => import('../pages/KirkpatrickBehaviorPage.vue'),
  props: () => ({ basePath: mount.prefix }),
  meta: {
    layout: mount.layout,
    access: 'auth',
    roles: rolesOf(mount),
    module: 'M12',
    title: 'Tahap 3: Tingkah Laku — Kirkpatrick',
    header: {
      title: 'Tahap 3: Tingkah Laku',
      subtitle: 'Konsistensi penggunaan, engagement score, dan corak tingkah laku pelajar',
    },
  },
}))

export default routes
