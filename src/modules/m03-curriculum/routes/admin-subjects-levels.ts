import type { RouteRecordRaw } from 'vue-router'

import { LEVEL_ROUTES, SUBJECT_ROUTES } from '../lib/subjects-levels'

/**
 * M03 route fragment: S6-S8 subjects and S9-S11 education levels (M03-T2; SRS §2). Admin only
 * (`/admin/*`, admin shell). Header and tab titles are exact (SRS §2). A non-numeric `:id` matches
 * no route and falls through to the global 404; an unknown numeric id is handled by the page
 * (redirect to the list with the one-time flash, BR-18).
 */
const meta = (title: string, header: { title: string; subtitle: string }) => ({
  layout: 'admin' as const,
  access: 'auth' as const,
  roles: ['admin'] as ['admin'],
  title,
  header,
  module: 'M03' as const,
})

const routes: RouteRecordRaw[] = [
  {
    path: '/admin/subjects',
    name: SUBJECT_ROUTES.list,
    component: () => import('../pages/SubjectListPage.vue'),
    meta: meta('Pengurusan Subjek - Admin PRESTASIPLUS', {
      title: 'Pengurusan Subjek',
      subtitle: 'Urus subjek pembelajaran dalam sistem',
    }),
  },
  {
    path: '/admin/subjects/create',
    name: SUBJECT_ROUTES.create,
    component: () => import('../pages/SubjectFormPage.vue'),
    props: { mode: 'create' },
    meta: meta('Tambah Subjek - Admin PRESTASIPLUS', {
      title: 'Tambah Subjek Baru',
      subtitle: 'Cipta subjek pembelajaran baharu',
    }),
  },
  {
    path: '/admin/subjects/:id(\\d+)/edit',
    name: SUBJECT_ROUTES.edit,
    component: () => import('../pages/SubjectFormPage.vue'),
    props: (route) => ({ mode: 'edit', id: Number(route.params.id) }),
    meta: meta('Edit Subjek - Admin PRESTASIPLUS', {
      title: 'Edit Subjek',
      subtitle: 'Kemaskini maklumat subjek',
    }),
  },
  {
    path: '/admin/education-levels',
    name: LEVEL_ROUTES.list,
    component: () => import('../pages/LevelListPage.vue'),
    meta: meta('Pengurusan Tahap Pendidikan - Admin PRESTASIPLUS', {
      title: 'Pengurusan Tahap Pendidikan',
      subtitle: 'Urus tahap pendidikan dalam sistem',
    }),
  },
  {
    path: '/admin/education-levels/create',
    name: LEVEL_ROUTES.create,
    component: () => import('../pages/LevelFormPage.vue'),
    props: { mode: 'create' },
    meta: meta('Tambah Tahap Pendidikan - Admin PRESTASIPLUS', {
      title: 'Tambah Tahap Pendidikan',
      subtitle: 'Cipta tahap pendidikan baharu',
    }),
  },
  {
    path: '/admin/education-levels/:id(\\d+)/edit',
    name: LEVEL_ROUTES.edit,
    component: () => import('../pages/LevelFormPage.vue'),
    props: (route) => ({ mode: 'edit', id: Number(route.params.id) }),
    meta: meta('Edit Tahap Pendidikan - Admin PRESTASIPLUS', {
      title: 'Edit Tahap Pendidikan',
      subtitle: 'Kemaskini maklumat tahap pendidikan',
    }),
  },
]

export default routes
