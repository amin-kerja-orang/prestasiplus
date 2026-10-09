import type { RouteRecordRaw } from 'vue-router'

import { ADMIN_ROUTES } from '../lib/admin'

/**
 * M07 route fragment "admin" (M07-T3 / M07-T4; SRS M07 §2): S5 question list, S6 create, S7 edit
 * and S8 access. Admin only (`/admin/*`, admin shell; another role is sent to its landing path,
 * a guest to `/login`). Tab titles and shell headers are exact (SRS §2, §3). `create` is a static
 * segment and wins over `:id`; `:id` is digits only, so any other value (and the live-405
 * `/admin/pksk/questions/:id` without `/edit`) falls to the global 404 page. S7 sets its own
 * header (the subtitle carries the id, DV-M07-02).
 */
const meta = (title: string, header: { title: string; subtitle: string }) => ({
  layout: 'admin' as const,
  access: 'auth' as const,
  roles: ['admin'] as ['admin'],
  title,
  header,
  module: 'M07' as const,
})

const routes: RouteRecordRaw[] = [
  {
    path: '/admin/pksk/questions',
    name: ADMIN_ROUTES.list,
    component: () => import('../pages/PkskQuestionListPage.vue'),
    meta: meta('Soalan PKSK - Admin', {
      title: 'Soalan PKSK',
      subtitle: 'Urus soalan Pentaksiran Kemasukan Sekolah Khusus',
    }),
  },
  {
    path: '/admin/pksk/questions/create',
    name: ADMIN_ROUTES.create,
    component: () => import('../pages/PkskQuestionFormPage.vue'),
    props: { mode: 'create' },
    meta: meta('Tambah Soalan PKSK - Admin', {
      title: 'Tambah Soalan PKSK',
      subtitle: 'Cipta soalan baru untuk PKSK',
    }),
  },
  {
    path: '/admin/pksk/questions/:id([0-9]+)/edit',
    name: ADMIN_ROUTES.edit,
    component: () => import('../pages/PkskQuestionFormPage.vue'),
    props: (route) => ({ mode: 'edit', id: String(route.params.id) }),
    meta: meta('Edit Soalan PKSK - Admin', {
      title: 'Edit Soalan PKSK',
      subtitle: 'Kemaskini soalan',
    }),
  },
  {
    path: '/admin/pksk/access',
    name: ADMIN_ROUTES.access,
    component: () => import('../pages/PkskAccessPage.vue'),
    meta: meta('Akses PKSK - Admin', {
      title: 'Akses PKSK',
      subtitle: 'Urus akses premium pengguna',
    }),
  },
]

export default routes
