import type { RouteRecordRaw } from 'vue-router'

/**
 * M27 route fragment: S6 `/admin-sekolah/pelajar` "Senarai Pelajar", S12 `/admin-sekolah/pelajar/baru` "Tambah
 * Pelajar", S9 `/admin-sekolah/pelajar/:id` "Edit Pengguna" (SRS M27 Part B §14.2, FR-M27-38, 44, 88 to 98, 117
 * to 120; roles-matrix row L56). User shell, role `school_admin` only: every other signed-in role gets the in-place
 * 403 page (FR-M27-40); a guest goes to `/login`. `/pelajar/baru` is registered before `:id` (a non-digit id has no
 * route and falls to the global 404 page). The header sub-line of S6 (the school name) is set by the page.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin-sekolah/pelajar',
    name: 'm27.pelajar.list',
    component: () => import('../pages/SenaraiPelajarPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['school_admin'],
      onForbidden: '403',
      title: 'Senarai Pelajar - PRESTASIPLUS',
      header: { title: 'Senarai Pelajar' },
      module: 'M27',
      v2: true,
    },
  },
  {
    path: '/admin-sekolah/pelajar/baru',
    name: 'm27.pelajar.create',
    component: () => import('../pages/TambahPelajarPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['school_admin'],
      onForbidden: '403',
      title: 'Tambah Pelajar - PRESTASIPLUS',
      header: { title: 'Tambah Pelajar', subtitle: 'Cipta satu akaun pelajar' },
      module: 'M27',
      v2: true,
    },
  },
  {
    path: '/admin-sekolah/pelajar/:id(\\d+)',
    name: 'm27.pelajar.edit',
    component: () => import('../pages/EditPelajarPage.vue'),
    props: (route) => ({ id: Number(route.params.id) }),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['school_admin'],
      onForbidden: '403',
      title: 'Edit Pengguna - PRESTASIPLUS',
      header: { title: 'Edit Pengguna', subtitle: 'Kemaskini maklumat pengguna' },
      module: 'M27',
      v2: true,
    },
  },
]

export default routes
