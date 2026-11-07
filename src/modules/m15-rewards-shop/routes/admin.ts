import type { RouteRecordRaw } from 'vue-router'

import { HADIAH_ADMIN_COPY as HADIAH, TEBUSAN_ADMIN_COPY as TEBUSAN } from '../components/copy'

/**
 * M15 route fragment: R1-ADM-P2-07 `/admin/hadiah` and R1-ADM-P2-08 `/admin/hadiah/tebusan`
 * (30 P2-07, P2-08; S7-T11 part 1A). Admin shell, platform admin only. `RedemptionsAdminPage` serves
 * the queue route and is also the "Tebusan Queue" card of the list (decision 4 on #562). The new and
 * edit routes (`/baharu`, `/:id/edit`) are part 1B and are not registered here.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin/hadiah',
    name: 'm15.admin-hadiah',
    component: () => import('../pages/HadiahAdminPage.vue'),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: 'Kedai Hadiah Digital - Admin PRESTASIPLUS',
      header: { title: HADIAH.heading, subtitle: HADIAH.sub },
      module: 'M15',
      v2: true,
    },
  },
  {
    path: '/admin/hadiah/tebusan',
    name: 'm15.admin-redemptions',
    component: () => import('../pages/RedemptionsAdminPage.vue'),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: 'Tebusan Hadiah Pelajar - Admin PRESTASIPLUS',
      header: { title: TEBUSAN.heading, subtitle: TEBUSAN.sub },
      module: 'M15',
      v2: true,
    },
  },
]

export default routes
