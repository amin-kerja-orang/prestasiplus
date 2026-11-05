import type { RouteRecordRaw } from 'vue-router'

import { HADIAH_ADMIN_COPY as HADIAH, TEBUSAN_ADMIN_COPY as TEBUSAN } from '../components/copy'

/**
 * M15 route fragment: R1-ADM-P2-07 `/admin/hadiah` (+ `/baharu`, `/:id/edit`) and R1-ADM-P2-08
 * `/admin/hadiah/tebusan` (30 P2-07, P2-08; S7-T11). Admin shell, platform admin only. The catalogue
 * list and its form share `AdminHadiahPage` (`mode`), and `AdminRedemptionsPage` serves the queue
 * route and is also the "Tebusan Queue" card of the list (decision 4 on #562). The static paths come
 * before the `:id` one.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin/hadiah',
    name: 'm15.admin-hadiah',
    component: () => import('../pages/AdminHadiahPage.vue'),
    props: { mode: 'list' },
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
    path: '/admin/hadiah/baharu',
    name: 'm15.admin-hadiah-new',
    component: () => import('../pages/AdminHadiahPage.vue'),
    props: { mode: 'create' },
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: 'Tambah Hadiah - Admin PRESTASIPLUS',
      header: { title: HADIAH.form.createTitle },
      module: 'M15',
      v2: true,
    },
  },
  {
    path: '/admin/hadiah/tebusan',
    name: 'm15.admin-redemptions',
    component: () => import('../pages/AdminRedemptionsPage.vue'),
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
  {
    path: '/admin/hadiah/:id(\\d+)/edit',
    name: 'm15.admin-hadiah-edit',
    component: () => import('../pages/AdminHadiahPage.vue'),
    props: (route) => ({ mode: 'edit', id: String(route.params.id) }),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: 'Edit Hadiah - Admin PRESTASIPLUS',
      header: { title: HADIAH.form.editTitle },
      module: 'M15',
      v2: true,
    },
  },
]

export default routes
