import type { RouteRecordRaw } from 'vue-router'

import { STAFF_MOUNTS } from './mount'

/** M12 route fragment: S3 T2 Pembelajaran on `/admin/kirkpatrick/learning` and the `/guru` twin (M12-T2). */
const routes: RouteRecordRaw[] = STAFF_MOUNTS.map((mount): RouteRecordRaw => ({
  path: `${mount.prefix}/learning`,
  name: `${mount.name}-learning`,
  component: () => import('../pages/KirkpatrickLearningPage.vue'),
  props: () => ({ basePath: mount.prefix }),
  meta: {
    layout: mount.layout,
    access: 'auth',
    roles: mount.roles,
    module: 'M12',
    title: 'Tahap 2: Pembelajaran — Kirkpatrick',
    header: {
      title: 'Tahap 2: Pembelajaran',
      subtitle: 'Peningkatan pengetahuan, kemahiran, dan kefahaman pelajar',
    },
  },
}))

export default routes
