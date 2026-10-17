import type { RouteRecordRaw } from 'vue-router'

/**
 * M27 route fragment: S7 `/admin-sekolah/guru` "Senarai Guru", S11 `/admin-sekolah/guru/baru` "Cipta Pengguna",
 * S10 `/admin-sekolah/guru/:id` "Edit Pengguna" (SRS M27 Part B §14.2, FR-M27-38, 44, 99 to 110; roles-matrix row
 * L57). User shell, role `school_admin` only (FR-M27-40). `/guru/baru` is registered before `:id`; a non-digit id has
 * no route and falls to the global 404 page. The header sub-line of S7 (the school name) is set by the page.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin-sekolah/guru',
    name: 'm27.guru.list',
    component: () => import('../pages/SenaraiGuruPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['school_admin'],
      onForbidden: '403',
      title: 'Senarai Guru - PRESTASIPLUS',
      header: { title: 'Senarai Guru' },
      module: 'M27',
      v2: true,
    },
  },
  {
    path: '/admin-sekolah/guru/baru',
    name: 'm27.guru.create',
    component: () => import('../pages/CiptaGuruPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['school_admin'],
      onForbidden: '403',
      title: 'Cipta Pengguna - PRESTASIPLUS',
      header: { title: 'Cipta Pengguna', subtitle: 'Daftarkan akaun guru ke sekolah anda' },
      module: 'M27',
      v2: true,
    },
  },
  {
    path: '/admin-sekolah/guru/:id(\\d+)',
    name: 'm27.guru.edit',
    component: () => import('../pages/EditGuruPage.vue'),
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
