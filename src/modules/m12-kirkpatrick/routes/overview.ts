import type { RouteRecordRaw } from 'vue-router'

import { ADMIN_MOUNT, GURU_MOUNT, SCHOOL_ADMIN_MOUNT, type KirkpatrickMount } from './mount'

/**
 * M12 route fragment: S1 overview on `/admin/kirkpatrick`, the `/guru/kirkpatrick` twin and the
 * `/admin-sekolah/kirkpatrick` mount (user shell, data forced to the viewer's school by the API and shown as a
 * locked school label; its detail links are on, all seven screens exist under it: FR-AS-11-1). M12-T2, S6-T02.
 * The mounts reuse the S1 header and tab title unchanged.
 */
const meta = (mount: KirkpatrickMount) => ({
  layout: mount.layout,
  access: 'auth' as const,
  roles: mount.roles,
  module: 'M12' as const,
  v2: true,
  title: 'Kirkpatrick Evaluation Dashboard',
  header: {
    title: 'Kirkpatrick Evaluation',
    subtitle: 'Analisis Keberkesanan Platform — Model Penilaian 4 Tahap',
  },
})

const routes: RouteRecordRaw[] = [
  ...[ADMIN_MOUNT, GURU_MOUNT].map((mount): RouteRecordRaw => ({
    path: mount.prefix,
    name: mount.name,
    component: () => import('../pages/KirkpatrickOverviewPage.vue'),
    props: () => ({
      basePath: mount.prefix,
      detailLinks: true,
      showComparison: mount !== GURU_MOUNT,
    }),
    meta: meta(mount),
  })),
  {
    path: SCHOOL_ADMIN_MOUNT.prefix,
    name: SCHOOL_ADMIN_MOUNT.name,
    component: () => import('../pages/KirkpatrickOverviewPage.vue'),
    props: () => ({ basePath: SCHOOL_ADMIN_MOUNT.prefix, detailLinks: true, scopeForced: true }),
    meta: meta(SCHOOL_ADMIN_MOUNT),
  },
]

export default routes
