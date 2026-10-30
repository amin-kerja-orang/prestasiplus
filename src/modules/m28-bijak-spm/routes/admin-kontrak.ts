import type { RouteRecordRaw } from 'vue-router'

import { KONTRAK_ROUTES } from '../admin/kontrak/server/api'

/**
 * Bijak SPM Kontrak Blueprint (v2-bijak-spm-standards K1 to K3): list, editor with verification,
 * and the pool preview. Admin Pusat only; the Pentadbiran menu entry KS-08 points at the list.
 */
const base = {
  layout: 'admin',
  access: 'auth',
  roles: ['admin'],
  module: 'M06',
  v2: true,
} as const

const routes: RouteRecordRaw[] = [
  {
    path: '/admin/spm/kontrak',
    name: KONTRAK_ROUTES.list,
    component: () => import('../admin/kontrak/pages/KontrakListPage.vue'),
    meta: {
      ...base,
      title: 'Kontrak Blueprint - Admin PRESTASIPLUS',
      header: { title: 'Kontrak Blueprint', subtitle: 'Piawaian kertas SPM bagi Jana Kertas' },
    },
  },
  {
    path: '/admin/spm/kontrak/:subjek/:kertas',
    name: KONTRAK_ROUTES.edit,
    component: () => import('../admin/kontrak/pages/KontrakEditorPage.vue'),
    meta: {
      ...base,
      title: 'Penyunting Kontrak - Admin PRESTASIPLUS',
      header: { title: 'Penyunting Kontrak' },
    },
  },
  {
    path: '/admin/spm/kontrak/:subjek/:kertas/kolam',
    name: KONTRAK_ROUTES.pool,
    component: () => import('../admin/kontrak/pages/KontrakPoolPage.vue'),
    meta: {
      ...base,
      title: 'Pratonton Kolam - Admin PRESTASIPLUS',
      header: { title: 'Pratonton Kolam' },
    },
  },
]

export default routes
