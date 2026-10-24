import type { RouteRecordRaw } from 'vue-router'

import { rolesOf } from './access'
import { STAFF_MOUNTS } from './mount'

/**
 * M12 route fragment: S6 Rantaian Impak on `/admin/kirkpatrick/chain` and the `/guru` twin, plus the PDF target
 * `{prefix}/export-pdf` of "Muat Turun Laporan" (FR-M12-61, provisional; bare layout, it opens in a new tab). M12-T3.
 * The shell header is "Rantaian Impak" with no subtitle (DV-M12-03).
 */
const routes: RouteRecordRaw[] = STAFF_MOUNTS.flatMap((mount): RouteRecordRaw[] => [
  {
    path: `${mount.prefix}/chain`,
    name: `${mount.name}-chain`,
    component: () => import('../pages/KirkpatrickChainPage.vue'),
    props: () => ({ basePath: mount.prefix }),
    meta: {
      layout: mount.layout,
      access: 'auth',
      roles: rolesOf(mount),
      module: 'M12',
      v2: true,
      title: 'Rantaian Impak Kirkpatrick',
      header: { title: 'Rantaian Impak' },
    },
  },
  {
    path: `${mount.prefix}/export-pdf`,
    name: `${mount.name}-export-pdf`,
    component: () => import('../pages/KirkpatrickChainPdfPage.vue'),
    meta: {
      layout: 'bare',
      access: 'auth',
      roles: rolesOf(mount),
      module: 'M12',
      v2: true,
      title: 'Rantaian Impak Kirkpatrick',
    },
  },
])

export default routes
