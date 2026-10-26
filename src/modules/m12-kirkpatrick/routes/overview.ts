import type { RouteRecordRaw } from 'vue-router'

import { ADMIN_MOUNT, GURU_MOUNT, SCHOOL_ADMIN_MOUNT, type KirkpatrickMount } from './mount'

/**
 * M12 route fragment: S1 overview on `/admin/kirkpatrick`, the `/guru/kirkpatrick` twin and the
 * `/admin-sekolah/kirkpatrick` alias (user shell, S1 only, data forced to the viewer's school by the
 * handlers; its detail links are off). M12-T2.
 *
 * INFERRED / provisional: the alias route, its role (`school_admin`), the user shell and the scope forcing come
 * from build-plan v1.12 R.1.3 and G4 decision F6; neither live nor the SRS shows them. The alias reuses the S1
 * header and tab title unchanged.
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
    props: () => ({ basePath: mount.prefix, detailLinks: true }),
    meta: meta(mount),
  })),
  {
    path: SCHOOL_ADMIN_MOUNT.prefix,
    name: SCHOOL_ADMIN_MOUNT.name,
    component: () => import('../pages/KirkpatrickOverviewPage.vue'),
    props: () => ({ basePath: SCHOOL_ADMIN_MOUNT.prefix, detailLinks: false, scopeForced: true }),
    meta: meta(SCHOOL_ADMIN_MOUNT),
  },
]

export default routes
