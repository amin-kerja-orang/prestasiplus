import type { RouteRecordRaw } from 'vue-router'

import { SCHOOL_ROUTES } from '../lib/school-options'

/**
 * M02 route fragment: S9 school list, S10 add school, S11 edit school (M02-T8; FR-M02-76..81).
 * Admin only (`/admin/*`, admin shell). Tab titles are exact (SRS §2). S11's header subtitle is the
 * school name, so the page sets it with `usePageMeta().setHeader()` once the school is loaded; the
 * route header is the static part.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin/schools',
    name: SCHOOL_ROUTES.list,
    component: () => import('../pages/SchoolListPage.vue'),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: 'Urus Sekolah - Admin PRESTASIPLUS',
      header: { title: 'Sekolah', subtitle: 'Urus senarai sekolah' },
      module: 'M02',
    },
  },
  {
    path: '/admin/schools/create',
    name: SCHOOL_ROUTES.create,
    component: () => import('../pages/SchoolFormPage.vue'),
    props: { mode: 'create' },
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: 'Tambah Sekolah - Admin PRESTASIPLUS',
      header: { title: 'Tambah Sekolah', subtitle: 'Daftarkan sekolah baru' },
      module: 'M02',
    },
  },
  {
    path: '/admin/schools/:id(\\d+)/edit',
    name: SCHOOL_ROUTES.edit,
    component: () => import('../pages/SchoolFormPage.vue'),
    props: (route) => ({ mode: 'edit', id: Number(route.params.id) }),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: 'Edit Sekolah - Admin PRESTASIPLUS',
      header: { title: 'Edit Sekolah' },
      module: 'M02',
    },
  },
]

export default routes
