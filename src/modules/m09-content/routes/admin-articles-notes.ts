import type { RouteRecordRaw } from 'vue-router'

import { ARTICLE_ROUTES, NOTE_ROUTES } from '../lib/admin-articles-notes'

/**
 * M09 route fragment: S1-S4 admin articles and S5-S8 admin notes (SRS §2). Admin only (`/admin/*`,
 * admin shell). Tab titles and shell headers are exact (SRS §3). The `:id` is any string (not only
 * digits): an unknown or non-numeric id (e.g. `/admin/articles/categories`) is handled by the page
 * (back to the list; S3/S4 with a flash, S7/S8 without). `create` is a static segment and wins over
 * `:id`.
 */
const meta = (title: string, header: { title: string; subtitle: string }) => ({
  layout: 'admin' as const,
  access: 'auth' as const,
  roles: ['admin'] as ['admin'],
  title,
  header,
  module: 'M09' as const,
})

const routes: RouteRecordRaw[] = [
  {
    path: '/admin/articles',
    name: ARTICLE_ROUTES.list,
    component: () => import('../pages/AdminArticleListPage.vue'),
    meta: meta('Pengurusan Artikel - Admin PRESTASIPLUS', {
      title: 'Pengurusan Artikel',
      subtitle: 'Urus artikel dan konten pendidikan',
    }),
  },
  {
    path: '/admin/articles/create',
    name: ARTICLE_ROUTES.create,
    component: () => import('../pages/AdminArticleFormPage.vue'),
    props: { mode: 'create' },
    meta: meta('Tambah Artikel - Admin PRESTASIPLUS', {
      title: 'Tambah Artikel Baru',
      subtitle: 'Cipta artikel pendidikan baharu',
    }),
  },
  {
    path: '/admin/articles/:id/edit',
    name: ARTICLE_ROUTES.edit,
    component: () => import('../pages/AdminArticleFormPage.vue'),
    props: (route) => ({ mode: 'edit', id: String(route.params.id) }),
    meta: meta('Edit Artikel - Admin PRESTASIPLUS', {
      title: 'Edit Artikel',
      subtitle: 'Kemaskini artikel',
    }),
  },
  {
    path: '/admin/articles/:id',
    name: ARTICLE_ROUTES.preview,
    component: () => import('../pages/AdminArticlePreviewPage.vue'),
    props: (route) => ({ id: String(route.params.id) }),
    meta: meta('Lihat Artikel - Admin PRESTASIPLUS', {
      title: 'Lihat Artikel',
      subtitle: 'Paparan artikel',
    }),
  },
  {
    path: '/admin/notes',
    name: NOTE_ROUTES.list,
    component: () => import('../pages/AdminNoteListPage.vue'),
    meta: meta('Pengurusan Nota - Admin PRESTASIPLUS', {
      title: 'Pengurusan Nota',
      subtitle: 'Urus nota pembelajaran dan sumber belajar',
    }),
  },
  {
    path: '/admin/notes/create',
    name: NOTE_ROUTES.create,
    component: () => import('../pages/AdminNoteFormPage.vue'),
    props: { mode: 'create' },
    meta: meta('Tambah Nota - Admin PRESTASIPLUS', {
      title: 'Tambah Nota',
      subtitle: 'Cipta nota baharu',
    }),
  },
  {
    path: '/admin/notes/:id/edit',
    name: NOTE_ROUTES.edit,
    component: () => import('../pages/AdminNoteFormPage.vue'),
    props: (route) => ({ mode: 'edit', id: String(route.params.id) }),
    meta: meta('Edit Nota - Admin PRESTASIPLUS', {
      title: 'Edit Nota',
      subtitle: 'Kemaskini nota',
    }),
  },
  {
    path: '/admin/notes/:id',
    name: NOTE_ROUTES.preview,
    component: () => import('../pages/AdminNotePreviewPage.vue'),
    props: (route) => ({ id: String(route.params.id) }),
    meta: meta('Lihat Nota - Admin PRESTASIPLUS', {
      title: 'Lihat Nota',
      subtitle: 'Paparan nota',
    }),
  },
]

export default routes
