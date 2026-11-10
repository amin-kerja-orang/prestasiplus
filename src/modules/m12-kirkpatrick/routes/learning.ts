import type { RouteRecordRaw } from 'vue-router'

import { ALL_MOUNTS } from './mount'

/** M12 route fragment: S3 T2 Pembelajaran on `/admin/kirkpatrick/learning` and the `/guru` twin (M12-T2). */
const routes: RouteRecordRaw[] = ALL_MOUNTS.map((mount): RouteRecordRaw => ({
  path: `${mount.prefix}/learning`,
  name: `${mount.name}-learning`,
  component: () => import('../pages/KirkpatrickLearningPage.vue'),
  props: () => ({ basePath: mount.prefix }),
  meta: {
    layout: mount.layout,
    access: 'auth',
    roles: mount.roles,
    module: 'M12',
    v2: true,
    title: 'T2: Pembelajaran',
    header: {
      title: 'T2: Pembelajaran',
      subtitle: 'Kirkpatrick Tahap 2 — Peningkatan kemahiran',
    },
  },
}))

export default routes
