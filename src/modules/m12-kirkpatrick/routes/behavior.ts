import type { RouteRecordRaw } from 'vue-router'

import { rolesOf } from './access'
import { ALL_MOUNTS, SCHOOL_ADMIN_MOUNT } from './mount'

/** M12 route fragment: S4 T3 Tingkah Laku on `/admin/kirkpatrick/behavior` and the `/guru` and `/admin-sekolah` twins (M12-T3; the school administrator's school is forced and shown as a locked label). */
const routes: RouteRecordRaw[] = ALL_MOUNTS.map((mount): RouteRecordRaw => ({
  path: `${mount.prefix}/behavior`,
  name: `${mount.name}-behavior`,
  component: () => import('../pages/KirkpatrickBehaviorPage.vue'),
  props: () => ({ basePath: mount.prefix, scopeForced: mount === SCHOOL_ADMIN_MOUNT }),
  meta: {
    layout: mount.layout,
    access: 'auth',
    roles: rolesOf(mount),
    module: 'M12',
    v2: true,
    title: 'Tahap 3: Tingkah Laku — Kirkpatrick',
    header: {
      title: 'Tahap 3: Tingkah Laku',
      subtitle: 'Konsistensi penggunaan, engagement score, dan corak tingkah laku pelajar',
    },
  },
}))

export default routes
